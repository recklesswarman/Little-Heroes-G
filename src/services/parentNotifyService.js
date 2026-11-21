// Sends parent alerts (chore ready to approve, reward requested, boss beaten)
// to the app server's /api/notify, which forwards them to the family Pi's
// ntfy server (server/ntfyService.js). Parents subscribe to the topic in the
// ntfy phone app. Static hosts (GitHub Pages, Firebase Hosting) have no
// /api/notify, so failures are silent by design.
// Turn off on a device with VITE_PARENT_NOTIFY=false.

export function initParentNotifications() {
  if (typeof window === 'undefined' || window.__lhParentNotifyReady) return;
  if (String(import.meta.env?.VITE_PARENT_NOTIFY ?? 'true').toLowerCase() === 'false') return;
  window.__lhParentNotifyReady = true;
  window.addEventListener('lh:parent-notify', e => {
    const detail = e?.detail || {};
    if (!detail.kind) return;
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: detail.kind, kidName: detail.kidName, title: detail.title }),
      keepalive: true
    }).catch(() => {});
  });
}
