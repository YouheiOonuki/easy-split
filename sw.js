/* easy-split service worker — offline support for the app shell */
const CACHE = 'easy-split-v6';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'split.js',
  'main.js',
  'manifest.webmanifest',
  'favicon.svg',
  'icon-192.png',
  'guide.html',
  'guide-keisha.html',
  'guide-hasuu.html'
  // 運営者情報・プライバシーポリシーは yorozu-craft 共通ページ（../about.html 等）に移したのでキャッシュしない
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

// Every tool on yorozu-craft.com shares this origin and its Cache Storage,
// so only clean up easy-split's own old caches, never another tool's.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('easy-split-') && k !== CACHE).map(k => caches.delete(k))))
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
