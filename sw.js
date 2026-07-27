const CACHE_NAME = '500e-cache-v2';

const APP_SHELL = [
  './',
  './index.html',
  './feedback.html',
  './coords.json',
  './apple-touch-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// 带版本号的 CDN 资源不会变，其他都可能随时更新，一律连网优先
const CACHE_FIRST_HOSTS = ['unpkg.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (CACHE_FIRST_HOSTS.includes(url.hostname)) {
    // 版本号锁死的 CDN 资源：先用快取，没有才连网并存起来
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((resp) => {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            return resp;
          })
      )
    );
    return;
  }

  // 网页本身、Google Sheet 资料、coords.json：一律连网优先抓最新，抓不到才用上次快取的
  event.respondWith(
    fetch(req)
      .then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
