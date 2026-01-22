// service-worker.js
const CACHE_VERSION = "rackviz-cyber-v5"; // ✅ 每次改布局/放大规则，改这里：v6/v7...
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 离线必须的本地资源（App Shell）
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",

  // icons / images used by page
  "./icons/2025APC_final.png",
  "./icons/logo-andy.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // ✅ 清理旧版本缓存
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.startsWith(CACHE_VERSION))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// 判断是否为 HTML 导航
function isNavigationRequest(req) {
  return req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // 只处理同源
  if (url.origin !== self.location.origin) return;

  // ✅ 1) HTML 导航：Network First（并把最新页面写回缓存）
  if (isNavigationRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // 把最新 HTML 写入 runtime cache，确保离线打开是“新版本”
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        // 离线：优先匹配同一路径缓存；不行就回退到预缓存 index.html
        const cached = await caches.match(req);
        return cached || caches.match("./index.html");
      }
    })());
    return;
  }

  // ✅ 2) 其他同源资源：Cache First + 后台更新缓存
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
