const CACHE_NAME = 'rackviz-cyber-v2'; // 更新了版本号
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/2025APC_final.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  // 如果你本地有 CSS 或 JS 文件也可以加在这里
];

// 外部资源：Google Fonts
const FONT_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&display=swap',
  'https://fonts.gstatic.com/s/chakrapetch/v11/c7AeHi6M3atO3_Xv7Hq3Vz9V9A.woff2'
];

// Install: 预缓存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...ASSETS, ...FONT_ASSETS]);
    })
  );
  self.skipWaiting();
});

// Activate: 清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// Fetch: 缓存优先策略
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});