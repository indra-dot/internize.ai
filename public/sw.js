const CACHE_NAME = 'internize-ai-v3-cache';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Let browser handle external APIs directly (e.g. Google Gemini, Google Sites)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Stale-while-revalidate for local scripts and static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && event.request.method === 'GET') {
            const resToCache = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, resToCache);
            });
          }
          return networkRes;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
