// Service worker: caches the app shell only. Desk data (d/...) is always fetched fresh, never cached.
const SHELL = "fomo-desk-shell-v2";
const FILES = ["./", "index.html", "app.css", "app.js", "chart.js", "manifest.json", "icons/icon-192.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.includes("/d/")) return;   // data: network only
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(SHELL).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request)));
});
self.addEventListener("push", e => { const d = e.data ? e.data.json() : {}; e.waitUntil(self.registration.showNotification(d.title || "FOMO Desk", {body: d.body || "", data: {url: d.url}})); });
self.addEventListener("notificationclick", e => { e.notification.close(); if (e.notification.data && e.notification.data.url) e.waitUntil(clients.openWindow(e.notification.data.url)); });
