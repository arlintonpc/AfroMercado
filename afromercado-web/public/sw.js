const CACHE_VERSION = 'afromercado-pwa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CORE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
  '/og-logo.png',
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:css|js|mjs|woff2?|png|jpg|jpeg|gif|svg|webp|avif|ico)$/i.test(url.pathname)
  );
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      Promise.allSettled(
        CORE_ASSETS.map(asset => cache.add(new Request(asset, { cache: 'reload' })))
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => !key.startsWith(CACHE_VERSION)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => response)
        .catch(() => caches.match('/'))
    );
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.match(request).then(cached => {
      const refresh = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || refresh;
    })
  );
});
