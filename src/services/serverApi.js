// Where the app's server routes (/api/...) live.
//
// The Pi (server.js) and Firebase App Hosting serve the app and its API from the same
// origin, so paths stay relative. GitHub Pages and classic Firebase Hosting are static,
// so their builds set VITE_SERVER_API_BASE to the App Hosting URL and call its API
// cross-origin (server.js only allows the family's own site origins via CORS).
// Secrets such as the Gemini key stay on that server; nothing secret is in this file.

function readBase() {
  try {
    return String(import.meta.env?.VITE_SERVER_API_BASE ?? '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function getServerApiBase() {
  const base = readBase();
  return /^https:\/\//i.test(base) ? base : '';
}

/** Absolute or same-origin URL for a server route such as '/api/gemini/chat'. */
export function serverApiUrl(path) {
  const clean = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${getServerApiBase()}${clean}`;
}
