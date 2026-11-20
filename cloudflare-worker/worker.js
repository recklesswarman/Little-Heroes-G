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

// Order of preference when the requested model is unavailable.
const MODEL_CHAIN = [FLUX, SDXL_LIGHTNING, DREAMSHAPER, SDXL_BASE];

// Names older clients (and the first version of this Worker) used.
const MODEL_ALIASES = {
  "@cf/blackforestlabs/flux-1-schnell": FLUX
};

const ALLOWED_MODELS = [...MODEL_CHAIN, ...Object.keys(MODEL_ALIASES)];

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
        models: MODEL_CHAIN
      }, 200, corsHeaders);
    }

    // Only allow POST requests to / or /generate
    if (request.method !== "POST" || (url.pathname !== "/" && url.pathname !== "/generate")) {
      return json({ error: "Method not allowed. Use POST / or POST /generate" }, 405, corsHeaders);
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
        return json({ error: "Unsupported model", allowed: MODEL_CHAIN }, 400, corsHeaders);
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
      for (const model of buildModelOrder(requestedModel)) {
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

      const mimeType = sniffMime(bytes);

      // Return the raw image
      if (format === "image" || format === "binary") {
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": mimeType,
            "X-Image-Model": usedModel,
            "Cache-Control": "public, max-age=604800, immutable",
            ...corsHeaders
          }
        });
      }

      // Return Base64 Data URI in JSON format
      return json({
        success: true,
        dataUri: `data:${mimeType};base64,${arrayBufferToBase64(bytes)}`,
        mimeType,
        model: usedModel,
        fallbackFrom: usedModel !== buildModelOrder(requestedModel)[0] ? attempts : undefined,
        prompt: prompt.slice(0, 600),
        seed
      }, 200, corsHeaders);

    } catch (err) {
      return json({
        error: "Failed to generate image",
        details: err.message
      }, 500, corsHeaders);
    }
  }
};

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
