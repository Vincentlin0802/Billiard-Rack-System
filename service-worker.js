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
  return (
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // 只处理同源
  if (url.origin !== self.location.origin) return;

  // ✅ 1) HTML 导航：Stale-While-Revalidate（缓存优先 + 后台更新）
  if (isNavigationRequest(req)) {
    event.respondWith((async () => {
      // 先从 runtime 找（保证你“在线时更新过的最新 HTML”能离线打开）
      const runtimeCache = await caches.open(RUNTIME_CACHE);
      const cachedRuntime = await runtimeCache.match(req);

      // 再兜底到预缓存的 index.html（适合 SPA / GitHub Pages）
      const cachedShell = await caches.match("./index.html");

      // 后台更新：不阻塞页面返回
      const updatePromise = fetch(req)
        .then((fresh) => {
          if (fresh && fresh.ok) {
            runtimeCache.put(req, fresh.clone());
          }
          return fresh;
        })
        .catch(() => null);

      // 关键：先返回缓存（避免慢网卡死），同时触发后台更新
      return cachedRuntime || cachedShell || (await updatePromise) || cachedShell;
    })());
    return;
  }

  // ✅ 2) 其他同源资源：Cache First +（可选）后台更新
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);
    if (cached) {
      // 可选：后台更新（不阻塞）
      event.waitUntil(
        fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
          })
          .catch(() => {})
      );
      return cached;
    }

    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
