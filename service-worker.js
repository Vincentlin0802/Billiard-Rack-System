// service-worker.js
const CACHE_VERSION = "rackviz-cyber-v6";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
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
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function isNavigationRequest(req) {
  return req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // ✅ 1) HTML 导航：Cache First + 后台更新（关键：永远兜底到 ./index.html）
  if (isNavigationRequest(req)) {
    event.respondWith((async () => {
      // 永远准备一个“可返回”的兜底
      const shell = await caches.match("./index.html");

      // 先查 runtime：用“固定 key”存 HTML，避免不同路径导致 match 失败
      const runtime = await caches.open(RUNTIME_CACHE);
      const cachedHtml = await runtime.match("./index.html");

      // 后台更新：不影响打开速度
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            await runtime.put("./index.html", fresh.clone());
          }
        } catch (e) {
          // ignore
        }
      })());

      // 关键：永远先返回缓存；缓存没有也要返回 shell；再不行也不能“空”
      return cachedHtml || shell || fetch(req);
    })());
    return;
  }

  // ✅ 2) 其他资源：Cache First + 写入 runtime（失败也不返回 Response.error）
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      // 资源请求失败：如果没缓存就给一个可用的空响应，避免整页崩
      return new Response("", { status: 504, statusText: "Offline" });
    }
  })());
});
