const CACHE_NAME = 'lagarcontrol-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app2.js',
  './config.js',
  './manifest.json',
  './icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Peticiones a Firebase Realtime Database y CDN pasan directo a la red para mantener tiempo real
  if (e.request.url.includes('firebaseio.com') || e.request.url.includes('gstatic.com') || e.request.url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(fetch(e.request));
  } else {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        return cachedResponse || fetch(e.request);
      })
    );
  }
});