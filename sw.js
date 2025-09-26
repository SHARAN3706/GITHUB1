self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('ppt-cache-v1').then((cache) => cache.addAll([
    '/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest',
    '/i18n/en.json', '/i18n/hi.json', '/i18n/pa.json'
  ])));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => cached))
  );
});
