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

/**
 * Extra origins allowed to call the Meal Planner API (/api/meals/v1) from a browser, e.g. a
 * separate recipe app: MEALS_API_ORIGINS (comma separated https origins). The API still needs
 * its bearer token; this only lets a browser send the request.
 */
export function getMealsApiOrigins(env = process.env) {
  return new Set(String(env.MEALS_API_ORIGINS || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter((o) => /^https:\/\/[^/]+$/i.test(o)));
}

export function createApiCors({ env = process.env } = {}) {
  const allowed = getAllowedOrigins(env);
  const mealsOrigins = getMealsApiOrigins(env);
  return function apiCors(req, res, next) {
    const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
    const path = String(req.path || req.url || '');
    const mealsApi = path.startsWith('/meals/v1');
    const ok = Boolean(origin) && (allowed.has(origin) || (mealsApi && mealsOrigins.has(origin)));
    res.setHeader('Vary', 'Origin');
    if (ok) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', mealsApi ? 'GET, POST, PUT, PATCH, DELETE, OPTIONS' : 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', mealsApi ? 'Content-Type, Authorization' : 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      return res.status(ok ? 204 : 403).end();
    }
    return next();
  };
}
