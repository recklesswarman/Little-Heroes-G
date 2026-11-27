// Self-destructing Service Worker for retired origins (GitHub Pages & Classic Firebase Hosting).
// Replaces any previously installed PWA worker, clears stale caches, unregisters itself,
// and navigates open tabs to the canonical Firebase App Hosting URL.
const CANONICAL_ORIGIN = 'https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {
      // ignore cache cleanup errors
    }
    try {
      await self.registration.unregister();
    } catch (_) {
      // ignore unregister errors
    }
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if (client.navigate) {
          client.navigate(CANONICAL_ORIGIN + '/').catch(() => {});
        }
      }
    } catch (_) {
      // ignore client navigation errors
    }
  })());
});
