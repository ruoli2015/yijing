// Service worker: offline support. VERSION and FILES are stamped by scripts/build.mjs.
const VERSION = '3eed745445';
const FILES = [
  "./",
  "css/app.css",
  "data/audiobook.json",
  "data/yijing.json",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "js/audiobook.js",
  "js/divine.js",
  "js/hex.js",
  "js/main.js",
  "js/quiz.js",
  "js/store.js",
  "js/ui/browse.js",
  "js/ui/common.js",
  "js/ui/detail.js",
  "js/ui/divine.js",
  "js/ui/draw.js",
  "js/ui/home.js",
  "js/ui/identify.js",
  "js/ui/listen.js",
  "js/ui/order.js",
  "js/ui/progress.js",
  "js/ui/reveal.js",
  "manifest.webmanifest",
  "vendor/preact.js"
];
const CACHE = `yj-${VERSION}`;
const FONT_CACHE = 'yj-fonts';

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the browser's HTTP cache (GitHub Pages sends max-age=600), so a new
  // version never precaches stale files.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('yj-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache-first, kept across versions.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  // The audiobook streams with range requests straight from the network; it is too large to precache.
  if (url.pathname.includes('/audio/')) return;

  // App shell and data: cache-first (a new service worker version brings new files).
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./') : Response.error())),
    ),
  );
});
