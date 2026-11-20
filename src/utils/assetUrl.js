/**
 * assetUrl.js
 * Resolves public asset paths cleanly for both root hosting ('/', Firebase Hosting / App Hosting)
 * and subpath hosting ('/Little-Heroes-G/', GitHub Pages) using Vite's import.meta.env.BASE_URL.
 */

export function getPublicBaseUrl() {
  const raw = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
    ? import.meta.env.BASE_URL
    : '/';
  if (raw === './') return './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

// firebase.json marks everything under assets/** as immutable with a
// one-year max-age so unchanging bundle assets stay cheap to serve. Content
// under /assets (boss portraits, pet art, reward icons, ...) is regenerated
// in place at the same filename when it's refreshed, though, so without a
// cache-busting suffix browsers and the CDN edge would keep serving the old
// bytes for that whole year. Tag every resolved asset URL with the same
// APP_BUILD_VERSION index.html/sw.js already bump on any such refresh, so a
// version bump reliably forces a fresh fetch everywhere the asset is used.
function getAssetCacheBustVersion() {
  return (typeof window !== 'undefined' && window.__LITTLE_HEROES_VERSION__) || '';
}

export function resolvePublicAssetUrl(assetPath) {
  if (!assetPath || typeof assetPath !== 'string') return '';
  const trimmed = assetPath.trim();
  if (!trimmed) return '';
  if (/^(?:data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  // External/absolute URLs (CDNs, Firebase Storage signed URLs, ...) are
  // returned as-is -- they're outside our hosting cache-control rules, and
  // appending a query param could break a signed URL's signature.
  if (/^(?:https?:\/\/|\/\/[^/])/i.test(trimmed)) {
    return trimmed;
  }
  const version = getAssetCacheBustVersion();
  const withVersion = (url) => {
    if (!version) return url;
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
  };
  const base = getPublicBaseUrl();
  if (base !== '/' && base !== './' && trimmed.startsWith(base)) {
    return withVersion(trimmed);
  }
  const clean = trimmed.replace(/^\.\//, '').replace(/^\/+/, '');
  return withVersion(`${base}${clean}`);
}
