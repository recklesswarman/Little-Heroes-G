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

export function resolvePublicAssetUrl(assetPath) {
  if (!assetPath || typeof assetPath !== 'string') return '';
  const trimmed = assetPath.trim();
  if (!trimmed) return '';
  if (/^(?:data:|blob:|https?:\/\/|\/\/[^/])/i.test(trimmed)) {
    return trimmed;
  }
  const base = getPublicBaseUrl();
  if (base !== '/' && base !== './' && trimmed.startsWith(base)) {
    return trimmed;
  }
  const clean = trimmed.replace(/^\.\//, '').replace(/^\/+/, '');
  return `${base}${clean}`;
}
