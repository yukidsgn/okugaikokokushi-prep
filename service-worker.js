// File: service-worker.js
const CACHE_NAME = "kakomon-v7"; // ★ファイル更新のたびに数字を上げる
const ASSETS = [
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./logo.png"
];

// インストール：必要ファイルを事前キャッシュ
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(a => cache.add(a)))
    )
  );
  self.skipWaiting();
});

// 有効化：古いキャッシュを削除
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);

  // GET以外は何もしない
  if (req.method !== "GET") return;

  // 自分のサイト以外（スプレッドシートのcsv・Webフォント・外部画像等）は素通し＝常に最新
  if (url.origin !== self.location.origin) {
    return;
  }

  // HTML / JS はネットワーク優先（最新を取りに行く → 取れたらキャッシュ更新）
  const isHTML = req.mode === "navigate" ||
                 url.pathname.endsWith(".html") ||
                 url.pathname === "/" ||
                 url.pathname.endsWith("/");
  const isJS = url.pathname.endsWith(".js");

  if (isHTML || isJS) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // その他（画像・manifest等）はキャッシュ優先。無ければ取得してキャッシュ
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      });
    })
  );
});