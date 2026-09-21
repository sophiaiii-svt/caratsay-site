/* CaratSay service worker — minimal, PWA-install only.
   Only caches the PWA icon assets so "Add to Home Screen" works offline.
   App navigations / JS / CSS are intentionally NOT cached, so the existing
   no-cache update flow (fresh entry JS on every deploy) is preserved. */
const CACHE = "csw-icons-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // only intercept same-origin PWA icon files
  if (url.origin === location.origin && /icon-/.test(url.pathname)) {
    e.respondWith(
      (async () => {
        const c = await caches.open(CACHE);
        const cached = await c.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        c.put(req, res.clone());
        return res;
      })()
    );
  }
});
