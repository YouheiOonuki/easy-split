/* easy-split service worker — offline support for the app shell */
const CACHE = 'easy-split-v1';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'split.js',
  'main.js',
  'manifest.webmanifest',
  'favicon.svg',
  'icon-192.png',
  'about.html',
  'terms.html',
  'privacy.html',
  'guide-keisha.html',
  'guide-hasuu.html'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Same-origin GET only (ads and other third parties go straight to the network).
// Serve from cache immediately and refresh it in the background, so an update
// deployed to GitHub Pages shows up on the next visit.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(cached => {
        const network = fetch(req)
          .then(res => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
        return cached || network;
      })
    )
  );
});
