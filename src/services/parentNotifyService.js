// Sends parent alerts (chore ready to approve, reward requested, boss beaten) to the
// family ntfy server on the Pi. Parents subscribe to the topic in the ntfy phone app.
//
// 1. First try the app server's /api/notify (server/ntfyService.js). That works on the
//    Pi (server.js) and on Firebase App Hosting, where the publish token stays server-side.
// 2. Static hosts (GitHub Pages, Firebase Hosting) have no /api/notify, so if it isn't
//    there and the build has VITE_NTFY_PUBLIC_URL + VITE_NTFY_PUBLISH_TOKEN, post straight
//    to the Pi's ntfy through Tailscale Funnel. That token ends up in the public bundle,
//    so it must be PUBLISH-ONLY and limited to the one alerts topic (ntfy `access` write-only).
//    The message text comes from the same whitelist as the server (ntfyEvents.js).
// Turn off on a build with VITE_PARENT_NOTIFY=false.
import { buildNtfyRequest, NTFY_EVENT_KINDS } from './ntfyEvents.js';
import { serverApiUrl } from './serverApi.js';

function readEnv(name) {
  try {
    return String(import.meta.env?.[name] ?? '').trim();
  } catch {
    return '';
  }
}

export function getDirectNtfyConfig(env = null) {
  const get = (name) => (env ? String(env[name] ?? '').trim() : readEnv(name));
  const url = get('VITE_NTFY_PUBLIC_URL').replace(/\/+$/, '');
  const token = get('VITE_NTFY_PUBLISH_TOKEN');
  const topic = (get('VITE_NTFY_TOPIC') || 'little-heroes').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'little-heroes';
  if (!/^https:\/\//i.test(url) || !token) return null;
  const appUrl = env ? (env.VITE_APP_URL === undefined ? undefined : String(env.VITE_APP_URL).trim()) : (import.meta.env?.VITE_APP_URL === undefined ? undefined : String(import.meta.env.VITE_APP_URL).trim());
  return appUrl === undefined ? { url, token, topic } : { url, token, topic, appUrl };
}

async function postViaAppServer(payload, fetchImpl) {
  try {
    const res = await fetchImpl(serverApiUrl('/api/notify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
    if (!res.ok) return false;
    const type = res.headers?.get?.('content-type') || '';
    if (!type.includes('json')) return false; // static host served index.html
    const data = await res.json().catch(() => null);
    return data?.ok === true && data?.sent === true;
  } catch {
    return false;
  }
}

async function postDirectToNtfy(payload, config, fetchImpl) {
  const req = buildNtfyRequest(payload.kind, payload, config);
  if (!req) return false;
  try {
    const res = await fetchImpl(req.url, { ...req.init, keepalive: true });
    return res.ok;
  } catch {
    return false;
  }
}

/** Sends one alert. Resolves 'server', 'direct' or false. */
export async function sendParentAlert(detail = {}, { fetchImpl = globalThis.fetch, directConfig = getDirectNtfyConfig() } = {}) {
  if (typeof fetchImpl !== 'function') return false;
  if (!NTFY_EVENT_KINDS.includes(detail.kind)) return false;
  const payload = { kind: detail.kind, kidName: detail.kidName || '', title: detail.title || '' };
  if (await postViaAppServer(payload, fetchImpl)) return 'server';
  if (directConfig && await postDirectToNtfy(payload, directConfig, fetchImpl)) return 'direct';
  return false;
}

export function initParentNotifications() {
  if (typeof window === 'undefined' || window.__lhParentNotifyReady) return;
  if (String(import.meta.env?.VITE_PARENT_NOTIFY ?? 'true').toLowerCase() === 'false') return;
  window.__lhParentNotifyReady = true;
  window.addEventListener('lh:parent-notify', e => {
    const detail = e?.detail || {};
    if (!detail.kind) return;
    sendParentAlert(detail).catch(() => {});
  });
}
