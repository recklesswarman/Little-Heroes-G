/**
 * Cloudflare Workers AI - Free Image Generation API
 * Based on saurav-z/free-image-generation-api with production CORS & multi-model support
 *
 * Generates 3D Pixar / Claymation storybook illustrations using Cloudflare's free Workers AI
 * (Up to 100,000 requests/day).
 *
 * Access control: there is NO shared secret. A key sent from a browser is public, so instead
 * POST requests must come from an allowed Origin (ALLOWED_ORIGINS, comma-separated, exact match)
 * and are rate limited per IP (RATE_LIMITER binding, see wrangler.toml). An Origin header can be
 * forged by non-browser clients, so this limits casual abuse; the free-tier quota is the ceiling.
 *
 * Models: Cloudflare retires image models from time to time (the old SDXL base model stopped
 * working on 2026-11-20 and, because it was the only fallback, took every picture down with it).
 * So this Worker keeps an ordered chain. The requested model goes first, then the rest of the
 * chain, and the response says which model made the picture. If every model fails, the error lists
 * what each one said, so a retired model is visible at once instead of being hidden behind the
 * last fallback.
 *
 * Prompts: models that read long text (FLUX) get `prompt`, the detailed description. Models that only
 * read the first ~77 tokens (SDXL family) get `shortPrompt` when the client sent one.
 *
 * Same characters on every page: when the request carries `referenceImages` (up to 2 small
 * JPEG/PNG data URIs, normally the story's first picture), FLUX.2 [klein] 4B draws the new scene
 * with those pictures as references, so the hero and companion keep the same face, outfit and
 * style from page to page. If klein fails, the normal text-only chain runs as before.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "https://recklesswarman.github.io",
  "https://little-heroes-quest-8842.web.app",
  "https://little-heroes-quest-8842.firebaseapp.com",
  "https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app",
  "http://localhost:3000"
];

const FLUX = "@cf/black-forest-labs/flux-1-schnell";
const SDXL_LIGHTNING = "@cf/bytedance/stable-diffusion-xl-lightning";
const DREAMSHAPER = "@cf/lykon/dreamshaper-8-lcm";
const SDXL_BASE = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const FLUX2_KLEIN = "@cf/black-forest-labs/flux-2-klein-4b";
const FLUX2_KLEIN_9B = "@cf/black-forest-labs/flux-2-klein-9b"; // higher quality; used for "Change it" edits
const PHOENIX = "@cf/leonardo/phoenix-1.0"; // best at pictures that contain words

// Order of preference when the requested model is unavailable.
const MODEL_CHAIN = [FLUX, SDXL_LIGHTNING, DREAMSHAPER, SDXL_BASE];

// Names older clients (and the first version of this Worker) used.
const MODEL_ALIASES = {
  "@cf/blackforestlabs/flux-1-schnell": FLUX
};

const ALLOWED_MODELS = [...MODEL_CHAIN, FLUX2_KLEIN, FLUX2_KLEIN_9B, PHOENIX, ...Object.keys(MODEL_ALIASES)];

export const FEATURES = ["reference-images", "edit", "cutout", "phoenix"];

const MAX_REFERENCE_IMAGES = 2;
const MAX_REFERENCE_BYTES = 400 * 1024; // each; the client sends ~40-80 KB, 512 px or smaller
const KLEIN_WIDTH = 1024;
const KLEIN_HEIGHT = 768;
const MAX_EDIT_BYTES = 2 * 1024 * 1024; // picture to edit / cut out
const CUTOUT_SIZE = 512;

/** One picture (data URI) to edit or cut out, as { bytes, type }, or null if it is missing or too big. */
export function parseEditImage(raw) {
  const m = typeof raw === "string" ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(raw) : null;
  if (!m) return null;
  let bin;
  try { bin = atob(m[2]); } catch { return null; }
  if (bin.length < 500 || bin.length > MAX_EDIT_BYTES) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1] };
}

/** Prompt for "Change it": change only what was asked, keep the rest of the picture. */
export function buildEditPrompt(instruction) {
  return `Edit this picture: ${String(instruction).trim()}. Keep the same object, framing, plain background and soft 3D clay toy style.`.slice(0, FLUX_PROMPT_CHARS);
}

/** Phoenix takes JSON (prompt, guidance, steps, size, negative prompt). */
export function buildPhoenixInput({ prompt, seed, negative_prompt }) {
  return {
    prompt: String(prompt).slice(0, FLUX_PROMPT_CHARS),
    guidance: 2.5,
    seed,
    width: 1024,
    height: 768,
    num_steps: 25,
    negative_prompt
  };
}

/**
 * Cut the subject out of its background (transparent WebP) with the Images binding.
 * Never throws: on any problem the original picture comes back with cutout:false.
 */
export async function cutoutBytes(env, bytes) {
  try {
    if (!env || !env.IMAGES || typeof env.IMAGES.input !== "function") return { bytes, cutout: false };
    const stream = new Response(bytes).body;
    const out = await env.IMAGES.input(stream)
      .transform({ segment: "foreground", width: CUTOUT_SIZE, height: CUTOUT_SIZE, fit: "contain" })
      .output({ format: "image/webp" });
    const res = out.response();
    const result = new Uint8Array(await res.arrayBuffer());
    if (result.byteLength < 200) return { bytes, cutout: false };
    return { bytes: result, cutout: true };
  } catch (err) {
    console.warn(`Cutout failed: ${String(err && err.message ? err.message : err).slice(0, 200)}`);
    return { bytes, cutout: false };
  }
}

/** Valid reference pictures from the request as { bytes, type }; anything else is dropped. */
export function parseReferenceImages(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 8)) {
    if (out.length >= MAX_REFERENCE_IMAGES) break;
    const m = typeof item === "string" ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(item) : null;
    if (!m) continue;
    let bin;
    try { bin = atob(m[2]); } catch { continue; }
    if (bin.length < 500 || bin.length > MAX_REFERENCE_BYTES) continue;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    out.push({ bytes, type: m[1] });
  }
  return out;
}

/** The prompt klein gets: keep everyone from the reference picture(s), draw the new scene. */
export function buildReferencePrompt(prompt, count) {
  const refs = count > 1 ? "images 0 and 1" : "image 0";
  return `Keep the exact same hero child and companion characters from ${refs}: same face, hair, skin tone, outfit, colours and soft 3D clay storybook art style. Draw them in this new scene: ${String(prompt)}`.slice(0, FLUX_PROMPT_CHARS);
}

/** Multipart input for FLUX.2 klein with reference pictures. */
export async function buildKleinInput({ prompt, seed, references, raw = false }) {
  const form = new FormData();
  form.append("prompt", raw ? String(prompt).slice(0, FLUX_PROMPT_CHARS) : buildReferencePrompt(prompt, references.length));
  references.forEach((ref, i) => form.append(`input_image_${i}`, new Blob([ref.bytes], { type: ref.type }), `ref${i}.${ref.type === "image/png" ? "png" : "jpg"}`));
  form.append("width", String(KLEIN_WIDTH));
  form.append("height", String(KLEIN_HEIGHT));
  if (Number.isFinite(seed)) form.append("seed", String(Math.min(Math.abs(Math.floor(seed)), 2147483646)));
  // Passing the FormData through a Response serialises it and sets the boundary header.
  const packed = new Response(form);
  return { multipart: { body: packed.body, contentType: packed.headers.get("content-type") } };
}

const MAX_PROMPT_CHARS = 4000;
const FLUX_PROMPT_CHARS = 2000; // flux-1-schnell accepts up to 2048
const FLUX_STEPS = 6; // schnell is distilled for 1-8 steps; 6 is a good detail/speed balance

function getAllowedOrigins(env) {
  const configured = typeof env.ALLOWED_ORIGINS === "string"
    ? env.ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean)
    : [];
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

/** Requested model first, then every other model of the chain, no repeats. */
export function buildModelOrder(requested) {
  const first = MODEL_ALIASES[requested] || requested;
  return [first, ...MODEL_CHAIN.filter(m => m !== first)];
}

/** Input each model family understands. FLUX takes no negative prompt or seed; the SDXL family does. */
export function buildModelInput(model, { prompt, shortPrompt, seed, negative_prompt }) {
  if (model === PHOENIX) return buildPhoenixInput({ prompt, seed, negative_prompt });
  if (model === FLUX) {
    return { prompt: String(prompt).slice(0, FLUX_PROMPT_CHARS), steps: FLUX_STEPS };
  }
  // CLIP-based models read ~77 tokens: use the compact prompt when the client sent one.
  return { prompt: String(shortPrompt || prompt).slice(0, 1000), seed, negative_prompt };
}

/** Normalise what a model returned (binary stream, or JSON with base64) into JPEG/PNG bytes. */
export async function resultToBytes(result) {
  if (result && typeof result === "object" && typeof result.image === "string") {
    const bin = atob(result.image);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(await new Response(result).arrayBuffer());
}

function sniffMime(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const originAllowed = !!origin && getAllowedOrigins(env).includes(origin);

    // CORS headers are only ever granted to an allowed origin (never "*").
    const corsHeaders = {
      "Vary": "Origin",
      ...(originAllowed ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
        "Access-Control-Expose-Headers": "X-Image-Model",
        "Access-Control-Max-Age": "86400"
      } : {})
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: originAllowed ? 204 : 403, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      return json({
        status: "ok",
        service: "little-heroes-free-image-api",
        models: MODEL_CHAIN,
        referenceModel: FLUX2_KLEIN,
        features: FEATURES.filter(f => f !== "cutout" || !!env.IMAGES)
      }, 200, corsHeaders);
    }

    // Only allow POST requests to / or /generate
    if (request.method !== "POST" || (url.pathname !== "/" && url.pathname !== "/generate" && url.pathname !== "/cutout")) {
      return json({ error: "Method not allowed. Use POST / , POST /generate or POST /cutout" }, 405, corsHeaders);
    }

    // Origin allow-list (replaces the old shared API key)
    if (!originAllowed) {
      return json({ error: "Forbidden. Origin not allowed." }, 403, corsHeaders);
    }

    // Per-IP rate limit (skipped if the binding is not configured)
    if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return json({ error: "Too many requests. Please slow down." }, 429, {
          ...corsHeaders,
          "Retry-After": "60"
        });
      }
    }

    // Stand-alone background removal: POST /cutout { image: "data:image/...;base64,..." }
    if (url.pathname === "/cutout") {
      const cutBody = await request.json().catch(() => ({}));
      const img = parseEditImage(cutBody.image);
      if (!img) return json({ error: "image must be a PNG/JPEG/WebP data URI of at most 2 MB" }, 400, corsHeaders);
      const cut = await cutoutBytes(env, img.bytes);
      const cutMime = cut.cutout ? "image/webp" : img.type;
      return json({
        success: true,
        cutout: cut.cutout,
        mimeType: cutMime,
        dataUri: `data:${cutMime};base64,${arrayBufferToBase64(cut.bytes)}`
      }, 200, corsHeaders);
    }

    try {
      const body = await request.json().catch(() => ({}));
      const prompt = body.prompt;
      const shortPrompt = typeof body.shortPrompt === "string" ? body.shortPrompt : "";
      const requestedModel = body.model || MODEL_CHAIN[0];
      const format = body.format || "image"; // "image" | "base64" | "json"
      const seed = body.seed !== undefined && body.seed !== null
        ? Number(body.seed)
        : ((globalThis.crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff) || 1);
      const negative_prompt = body.negative_prompt || "pink, purple, magenta, violet, neon pink, scary, dark, deformed, blurry";

      if (!prompt || typeof prompt !== "string") {
        return json({ error: "Prompt is required and must be a string" }, 400, corsHeaders);
      }

      if (prompt.length > MAX_PROMPT_CHARS || shortPrompt.length > MAX_PROMPT_CHARS) {
        return json({ error: `Prompt is too long (max ${MAX_PROMPT_CHARS} characters)` }, 400, corsHeaders);
      }

      if (typeof requestedModel !== "string" || !ALLOWED_MODELS.includes(requestedModel)) {
        return json({ error: "Unsupported model", allowed: ALLOWED_MODELS }, 400, corsHeaders);
      }

      if (!env.AI) {
        return json({
          error: "Cloudflare Workers AI binding is missing.",
          hint: "Ensure your wrangler.toml or Cloudflare dashboard has the AI binding configured under `[ai] binding = 'AI'`."
        }, 500, corsHeaders);
      }

      // Try the requested model, then the rest of the chain; remember every failure.
      const attempts = [];
      let bytes = null;
      let usedModel = "";

      const wantCutout = body.cutout === true;
      const finish = async (outBytes, model, extra = {}) => {
        let finalBytes = outBytes;
        let cutDone = false;
        if (wantCutout) ({ bytes: finalBytes, cutout: cutDone } = await cutoutBytes(env, outBytes));
        return { finalBytes, cutDone, model, extra };
      };

      // "Change it": edit an existing picture. Never falls back to plain text-to-image,
      // because that would throw away the picture the child just made.
      if (body.mode === "edit") {
        const source = parseEditImage(body.image);
        if (!source) {
          return json({ error: "Edit mode needs image: a PNG/JPEG/WebP data URI of at most 2 MB" }, 400, corsHeaders);
        }
        const editModels = body.quality === "high" ? [FLUX2_KLEIN_9B, FLUX2_KLEIN] : [FLUX2_KLEIN];
        for (const model of editModels) {
          try {
            const result = await env.AI.run(model, await buildKleinInput({ prompt: buildEditPrompt(prompt), seed, references: [source], raw: true }));
            const out = await resultToBytes(result);
            if (out.byteLength < 1000) throw new Error(`model returned only ${out.byteLength} bytes`);
            bytes = out;
            usedModel = model;
            break;
          } catch (editErr) {
            const message = String(editErr && editErr.message ? editErr.message : editErr).slice(0, 300);
            console.warn(`Edit with ${model} failed: ${message}`);
            attempts.push({ model, error: message });
          }
        }
        if (!bytes) {
          return json({
            error: "Failed to edit image",
            details: attempts.map(a => `${a.model}: ${a.error}`).join(" | "),
            attempts
          }, 502, corsHeaders);
        }
        const done = await finish(bytes, usedModel);
        return imageResponse(done.finalBytes, done.cutDone ? "image/webp" : sniffMime(done.finalBytes), format, {
          model: usedModel, cutout: wantCutout ? done.cutDone : undefined, edited: true, prompt, seed, attempts
        }, corsHeaders);
      }

      // Reference pictures first: same characters on every page (FLUX.2 klein).
      const references = parseReferenceImages(body.referenceImages);
      if (references.length) {
        try {
          const result = await env.AI.run(FLUX2_KLEIN, await buildKleinInput({ prompt, seed, references }));
          const out = await resultToBytes(result);
          if (out.byteLength < 1000) throw new Error(`model returned only ${out.byteLength} bytes`);
          bytes = out;
          usedModel = FLUX2_KLEIN;
        } catch (kleinErr) {
          const message = String(kleinErr && kleinErr.message ? kleinErr.message : kleinErr).slice(0, 300);
          console.warn(`Model ${FLUX2_KLEIN} (with references) failed: ${message}`);
          attempts.push({ model: FLUX2_KLEIN, error: message });
        }
      }

      for (const model of bytes ? [] : buildModelOrder(requestedModel === FLUX2_KLEIN ? MODEL_CHAIN[0] : requestedModel)) {
        try {
          const result = await env.AI.run(model, buildModelInput(model, { prompt, shortPrompt, seed, negative_prompt }));
          const out = await resultToBytes(result);
          if (out.byteLength < 1000) throw new Error(`model returned only ${out.byteLength} bytes`);
          bytes = out;
          usedModel = model;
          break;
        } catch (aiErr) {
          const message = String(aiErr && aiErr.message ? aiErr.message : aiErr).slice(0, 300);
          console.warn(`Model ${model} failed: ${message}`);
          attempts.push({ model, error: message });
        }
      }

      if (!bytes) {
        return json({
          error: "Failed to generate image",
          details: attempts.map(a => `${a.model}: ${a.error}`).join(" | "),
          attempts
        }, 502, corsHeaders);
      }

      const done = await finish(bytes, usedModel);
      return imageResponse(done.finalBytes, done.cutDone ? "image/webp" : sniffMime(done.finalBytes), format, {
        model: usedModel,
        cutout: wantCutout ? done.cutDone : undefined,
        attempts,
        usedReferences: usedModel === FLUX2_KLEIN ? references.length : 0,
        prompt,
        seed
      }, corsHeaders);

    } catch (err) {
      return json({
        error: "Failed to generate image",
        details: err.message
      }, 500, corsHeaders);
    }
  }
};

/** Raw image or JSON data-URI response, depending on the requested format. */
function imageResponse(bytes, mimeType, format, info, corsHeaders) {
  if (format === "image" || format === "binary") {
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "X-Image-Model": info.model,
        "Cache-Control": "public, max-age=604800, immutable",
        ...corsHeaders
      }
    });
  }
  return json({
    success: true,
    dataUri: `data:${mimeType};base64,${arrayBufferToBase64(bytes)}`,
    mimeType,
    model: info.model,
    fallbackFrom: info.attempts && info.attempts.length ? info.attempts : undefined,
    usedReferences: info.usedReferences,
    cutout: info.cutout,
    edited: info.edited,
    prompt: String(info.prompt).slice(0, 600),
    seed: info.seed
  }, 200, corsHeaders);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

function arrayBufferToBase64(bytes) {
  let binary = "";
  const len = bytes.byteLength;
  // Chunked: String.fromCharCode(...bigArray) overflows the stack on a full-size picture.
  for (let i = 0; i < len; i += 8192) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
  }
  return btoa(binary);
}
