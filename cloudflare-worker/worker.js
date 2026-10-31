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
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "https://recklesswarman.github.io",
  "https://little-heroes-quest-8842.web.app",
  "https://little-heroes-quest-8842.firebaseapp.com",
  "https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app",
  "http://localhost:3000"
];

const ALLOWED_MODELS = [
  "@cf/bytedance/stable-diffusion-xl-lightning",
  "@cf/blackforestlabs/flux-1-schnell",
  "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  "@cf/lykon/dreamshaper-8-lcm"
];

const MAX_PROMPT_CHARS = 4000;

function getAllowedOrigins(env) {
  const configured = typeof env.ALLOWED_ORIGINS === "string"
    ? env.ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean)
    : [];
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
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
        models: ALLOWED_MODELS
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
      const model = body.model || ALLOWED_MODELS[0];
      const format = body.format || "image"; // "image" | "base64" | "json"
      const seed = body.seed !== undefined && body.seed !== null
        ? Number(body.seed)
        : Math.floor(Math.random() * 2147483647);
      const negative_prompt = body.negative_prompt || "pink, purple, magenta, violet, neon pink, scary, dark, deformed, blurry";

      if (!prompt || typeof prompt !== "string") {
        return json({ error: "Prompt is required and must be a string" }, 400, corsHeaders);
      }

      if (prompt.length > MAX_PROMPT_CHARS) {
        return json({ error: `Prompt is too long (max ${MAX_PROMPT_CHARS} characters)` }, 400, corsHeaders);
      }

      if (typeof model !== "string" || !ALLOWED_MODELS.includes(model)) {
        return json({ error: "Unsupported model", allowed: ALLOWED_MODELS }, 400, corsHeaders);
      }

      if (!env.AI) {
        return json({
          error: "Cloudflare Workers AI binding is missing.",
          hint: "Ensure your wrangler.toml or Cloudflare dashboard has the AI binding configured under `[ai] binding = 'AI'`."
        }, 500, corsHeaders);
      }

      const aiOptions = {
        prompt,
        seed,
        negative_prompt
      };

      // Generate image using Cloudflare Workers AI
      let result;
      try {
        result = await env.AI.run(model, aiOptions);
      } catch (aiErr) {
        // Fallback to SDXL base 1.0 if selected model is busy or unavailable
        console.warn(`Model ${model} failed, falling back to SDXL base:`, aiErr.message);
        result = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", aiOptions);
      }

      // Return raw JPEG image
      if (format === "image" || format === "binary") {
        return new Response(result, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=604800, immutable",
            ...corsHeaders
          }
        });
      }

      // Return Base64 Data URI in JSON format
      const buffer = await new Response(result).arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const dataUri = `data:image/jpeg;base64,${base64}`;

      return json({
        success: true,
        dataUri,
        mimeType: "image/jpeg",
        prompt,
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

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
