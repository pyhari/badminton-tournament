// Offline cache for the app itself (never for scores, which always come from /api).
// Pages: from the network when it answers quickly, else the copy saved last time.
// Built files (/assets/, with a hash in the name, so they never change): saved once, then read from the phone.
const PAGES = "pages-v1", FILES = "files-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== PAGES && k !== FILES) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") e.respondWith(page(req, e));
  else if (url.pathname.startsWith("/assets/") || /\.(png|svg|webmanifest)$/.test(url.pathname)) e.respondWith(file(req));
});

async function page(req, e) {
  const cache = await caches.open(PAGES), key = new URL(req.url).pathname;
  const net = fetch(req).then(r => { if (r.ok) e.waitUntil(cache.put(key, r.clone())); return r; });
  const saved = await cache.match(key);
  if (!saved) return net;
  // A slow venue connection: show the saved page after 2 seconds instead of waiting.
  const late = new Promise(ok => setTimeout(() => ok(saved), 2000));
  return Promise.race([net.catch(() => saved), late]);
}

async function file(req) {
  const cache = await caches.open(FILES), saved = await cache.match(req);
  if (saved) return saved;
  const r = await fetch(req);
  if (r.ok) {
    await cache.put(req, r.clone());
    // Keep the newest 80 files, so old versions do not pile up after each deploy.
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - 80))) await cache.delete(k);
  }
  return r;
}
