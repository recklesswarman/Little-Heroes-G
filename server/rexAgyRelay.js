// Relays the "AI hero agent" routes (/api/rex/*) from this server to the AGY Rex
// microservice on Cloud Run (little-heroes-rex-agy, see little-heroes-agy-service/).
//
// Before this, only classic Firebase Hosting reached that service (through its
// firebase.json rewrite). The Pi and App Hosting answered /api/rex/* with index.html,
// and GitHub Pages had no server at all, so Rex chat, voice, battle coach, quest guide,
// parent report and proactive nudges quietly fell back to canned lines there.
// Now every host's browser calls this server (same origin, or VITE_SERVER_API_BASE
// cross-origin), and this server calls Cloud Run server-to-server, so the AGY
// service's own CORS list no longer matters.
//
//   AGY_REX_SERVICE_URL  Cloud Run base URL (defaults to the deployed service below).
//                        Set to "off" to disable the relay (routes answer 503).
//
// /api/rex/bedtime-story is not relayed: server.js answers it with Gemini directly.
export const DEFAULT_AGY_REX_SERVICE_URL = 'https://little-heroes-rex-agy-bnocc5pgdq-uc.a.run.app';
export const REX_RELAY_MAX_BYTES = 8 * 1024 * 1024;

// Route -> upstream timeout. Anything else under /api/rex is passed on (next()).
const ROUTES = Object.freeze({
  'POST /chat': 20000,
  'POST /audio': 30000,
  'POST /battle-coach': 10000,
  'POST /quest-guide': 10000,
  'POST /parent-report': 45000,
  'POST /proactive': 10000,
  'GET /health': 5000
});

const FORWARDED_TYPES = /^(application\/json|multipart\/form-data)/i;

export function getRexRelayConfig(env = process.env) {
  const raw = String(env.AGY_REX_SERVICE_URL ?? '').trim();
  if (/^(off|false|0|none)$/i.test(raw)) return null;
  const url = (raw || DEFAULT_AGY_REX_SERVICE_URL).replace(/\/+$/, '');
  return /^https:\/\/[^/\s]+$/i.test(url) ? { url } : null;
}

/**
 * Express middleware for app.use('/api/rex', ...). Mount it BEFORE express.json():
 * it reads the raw body itself so multipart audio uploads pass through untouched.
 */
export function createRexRelay({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const cfg = getRexRelayConfig(env);

  return async function rexRelay(req, res, next) {
    const routePath = String(req.path || '/').replace(/\/+$/, '') || '/';
    const timeoutMs = ROUTES[`${req.method} ${routePath}`];
    if (!timeoutMs) return next();

    if (!cfg) return res.status(503).json({ error: 'AI hero agent relay is turned off' });

    let body;
    if (req.method === 'POST') {
      const type = String(req.headers?.['content-type'] || '');
      if (!FORWARDED_TYPES.test(type)) return res.status(415).json({ error: 'Unsupported content type' });
      try {
        body = await readBody(req, REX_RELAY_MAX_BYTES);
      } catch (err) {
        return res.status(err?.status || 400).json({ error: err?.message || 'Bad request body' });
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetchImpl(`${cfg.url}/api/rex${routePath}`, {
        method: req.method,
        headers: body ? { 'Content-Type': req.headers['content-type'] } : {},
        body,
        signal: controller.signal
      });
      const text = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers?.get?.('content-type') || 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(text);
    } catch (err) {
      const timedOut = err?.name === 'AbortError';
      console.warn(`[rexAgyRelay] ${routePath} ${timedOut ? 'timed out' : 'failed'}:`, err?.message || err);
      return res.status(timedOut ? 504 : 502).json({ error: 'AI hero agent unavailable' });
    } finally {
      clearTimeout(timer);
    }
  };
}

// Reads the request body as a Buffer. If some earlier middleware already parsed JSON,
// re-serialize it so the relay still works.
function readBody(req, limit) {
  if (req.body !== undefined && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(Buffer.from(JSON.stringify(req.body)));
  }
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
