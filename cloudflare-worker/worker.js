/**
 * Cloudflare Workers AI - Free Image Generation API
 * Based on saurav-z/free-image-generation-api with production CORS & multi-model support
 * 
 * Generates 3D Pixar / Claymation storybook illustrations using Cloudflare's free Workers AI
 * (Up to 100,000 requests/day).
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
      "Access-Control-Max-Age": "86400"
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      return json({
        status: "ok",
        service: "little-heroes-free-image-api",
        models: [
          "@cf/bytedance/stable-diffusion-xl-lightning",
          "@cf/blackforestlabs/flux-1-schnell",
          "@cf/stabilityai/stable-diffusion-xl-base-1.0",
          "@cf/lykon/dreamshaper-8-lcm"
        ]
      }, 200, corsHeaders);
    }

    // Only allow POST requests to / or /generate
    if (request.method !== "POST" || (url.pathname !== "/" && url.pathname !== "/generate")) {
      return json({ error: "Method not allowed. Use POST / or POST /generate" }, 405, corsHeaders);
    }

    // Optional API Key check if configured in Cloudflare environment variables
    const API_KEY = env.API_KEY;
    if (API_KEY) {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${API_KEY}`) {
        return json({ error: "Unauthorized. Valid Bearer API_KEY required." }, 401, corsHeaders);
      }
    }

    try {
      const body = await request.json().catch(() => ({}));
      const prompt = body.prompt;
      const model = body.model || "@cf/bytedance/stable-diffusion-xl-lightning";
      const format = body.format || "image"; // "image" | "base64" | "json"
      const seed = body.seed !== undefined && body.seed !== null
        ? Number(body.seed)
        : Math.floor(Math.random() * 2147483647);
      const negative_prompt = body.negative_prompt || "pink, purple, magenta, violet, neon pink, scary, dark, deformed, blurry";

      if (!prompt || typeof prompt !== "string") {
        return json({ error: "Prompt is required and must be a string" }, 400, corsHeaders);
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
