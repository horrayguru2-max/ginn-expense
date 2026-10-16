const CACHE = 'expense-mvat4jm2';
const SHELL = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'shared/logic.js', 'shared/seed.js', 'shared/schema.js', 'shared/memory-store.js', 'shared/api-core.js',
  'js/app.js', 'js/api.js', 'js/format.js', 'js/image.js',
  'js/views/home.js', 'js/views/add.js', 'js/views/accounts.js', 'js/views/stocktake.js', 'js/views/settings.js', 'js/views/sheets.js', 'js/views/setup.js', 'js/views/search.js',
  'icons/icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
