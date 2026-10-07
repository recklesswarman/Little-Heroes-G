const CACHE_NAME = 'little-heroes-v3.3.0-rewards-revamp-20261007';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Offline 3D asset extensions
const THREE_D_EXTENSIONS = ['.splinecode', '.glb', '.gltf', '.mp3', '.wav', '.ogg', '.png', '.jpg', '.svg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cache) => cache !== CACHE_NAME)
          .map((cache) => {
            console.log('[SW] Deleting obsolete cache:', cache);
            return caches.delete(cache);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  const is3DAsset = THREE_D_EXTENSIONS.some(ext => url.pathname.endsWith(ext)) ||
                    url.pathname.includes('/assets/3d/') ||
                    url.hostname.includes('spline.design');

  if (is3DAsset) {
    // Cache-first strategy for 3D assets to enable instant bathroom offline loading
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Offline fallback
            return cachedResponse || new Response(new ArrayBuffer(0), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
          });
        });
      })
    );
    return;
  }

  // Network first falling back to cache for application pages & logic
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.status === 200 && event.request.method === 'GET') {
        const isAsset = url.pathname.startsWith('/assets/');
        const isHtml = (response.headers.get('content-type') || '').includes('text/html');
        // Never cache HTML responses for asset endpoints
        if (!isAsset || !isHtml) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
