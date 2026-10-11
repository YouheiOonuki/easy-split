/* easy-split service worker — offline support for the app shell */
const CACHE = 'easy-split-v13';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'split.js',
  'screen.js',
  'main.js',
  'reset-storage.js',
  'manifest.webmanifest',
  'favicon.svg',
  'icon-192.png',
  'guide.html',
  'guide-keisha.html',
  'guide-hasuu.html',
  // 家計簿テンプレート（/easy-split/kakeibo/）
  'kakeibo/',
  'kakeibo/index.html',
  'kakeibo/kakeibo.css',
  'kakeibo/kakeibo-calc.js',
  'kakeibo/kakeibo.js',
  'kakeibo/guide.html'
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
// ネットワーク優先（yorozu-plans ROADMAP 7.42 D309: HTML をキャッシュ優先で返すと、公開した新しい画面が出ず古い画面が残る）。
// オンラインなら常にネットワークの応答を返してキャッシュも更新し、オフライン（または 4 秒応答が無い）ときだけキャッシュを返す。
// ほかのツールと同じ形（yorozu-template の sw.js）
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (!new URL(req.url).pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;

  const fromNetwork = fetch(req);
  event.waitUntil(
    fromNetwork
      .then(res => {
        if (!res.ok || res.redirected) return undefined;
        const copy = res.clone();
        return caches.open(CACHE).then(cache => cache.put(req, copy));
      })
      .catch(() => undefined)
  );
  event.respondWith(networkFirst(req, fromNetwork));
});

async function networkFirst(req, fromNetwork) {
  try {
    const res = await Promise.race([fromNetwork, new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS, null))]);
    if (res) return res;
  } catch (e) {
    // オフライン: 下でキャッシュを探す
  }
  const cache = await caches.open(CACHE);
  const cached = req.mode === 'navigate'
    ? (await cache.match(req, { ignoreSearch: true })) || cache.match('index.html')
    : await cache.match(req);
  return cached || fromNetwork;
}
