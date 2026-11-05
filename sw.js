/* VARMEKS QC — çevrimdışı açılış için önbellek. Veriler Supabase'e gider; buradan geçmez. */
var V = "qc-v1";
var CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-180.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (/supabase\.co$/.test(url.hostname)) return; // veri istekleri her zaman ağa gider
  var page = req.mode === "navigate" || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));
  if (page) { // önce ağ: yeni sürüm hemen gelsin; ağ yoksa önbellek
    e.respondWith(fetch(req).then(function (res) { var cp = res.clone(); caches.open(V).then(function (c) { c.put("./index.html", cp); }); return res; })
      .catch(function () { return caches.match("./index.html").then(function (r) { return r || caches.match("./"); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) { if (res && (res.ok || res.type === "opaque")) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(req, cp); }); } return res; });
  }));
});
