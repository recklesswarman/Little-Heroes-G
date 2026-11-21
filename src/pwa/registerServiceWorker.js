// Registers the vite-plugin-pwa (Workbox) service worker that replaced the
// hand-maintained public/sw.js. `registerType: 'autoUpdate'` in vite.config.js
// means a new deploy installs in the background, takes over with skipWaiting +
// clientsClaim, and the page reloads itself once onto the new build.
import { registerSW } from 'virtual:pwa-register';

// Caches made by the old hand-written worker were named "little-heroes-<version>".
// Workbox only cleans up its own precaches, so remove the legacy ones once.
async function deleteLegacyCaches() {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('little-heroes-')).map(k => caches.delete(k)));
  } catch (err) {
    console.warn('[PWA] Legacy cache cleanup skipped:', err);
  }
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  deleteLegacyCaches();
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.log('[PWA] Ready to work offline.');
    },
    onRegisteredSW(swUrl, registration) {
      // Check for a fresh build every hour while the app stays open on a tablet.
      if (registration) {
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      }
    },
    onRegisterError(err) {
      console.warn('[PWA] Service Worker registration skipped:', err);
    }
  });
}
