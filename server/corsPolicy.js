// Lets the family's static sites (GitHub Pages, classic Firebase Hosting) call this
// server's /api routes cross-origin. Only these exact origins are allowed; every other
// site gets no CORS headers, so browsers block it. Override with CORS_ALLOWED_ORIGINS
// (comma separated). Same-origin requests (the Pi, App Hosting) need none of this.
export const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  'https://recklesswarman.github.io',
  'https://little-heroes-quest-8842.web.app',
  'https://little-heroes-quest-8842.firebaseapp.com'
]);

export function getAllowedOrigins(env = process.env) {
  const raw = String(env.CORS_ALLOWED_ORIGINS || '').trim();
  const list = raw ? raw.split(',') : DEFAULT_ALLOWED_ORIGINS;
  return new Set(list.map((o) => o.trim().replace(/\/+$/, '')).filter((o) => /^https:\/\/[^/]+$/i.test(o)));
}

export function createApiCors({ env = process.env } = {}) {
  const allowed = getAllowedOrigins(env);
  return function apiCors(req, res, next) {
    const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
    res.setHeader('Vary', 'Origin');
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      return res.status(origin && allowed.has(origin) ? 204 : 403).end();
    }
    return next();
  };
}
