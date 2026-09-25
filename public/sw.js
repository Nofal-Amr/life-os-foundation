/*
 * Life OS service worker: lets the installed web app (iPhone "Add to Home
 * Screen", or any browser install) open without a connection.
 *
 * - Built files under /assets/ have hashed names, so they are cached once
 *   and served from the cache.
 * - Pages go to the network first; when offline, the last copy of that page
 *   (or of any page, since they share one app shell) is shown.
 * - Nothing from other origins is touched: Supabase data keeps using the
 *   app's own offline store, and Google sign-in is never cached.
 */
const CACHE = "life-os-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/assets/") || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
            cache.put("/__shell", response.clone());
          }
          return response;
        } catch {
          return (
            (await cache.match(request)) ??
            (await cache.match("/__shell")) ??
            new Response("You're offline, and this page hasn't been opened here before.", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
  }
});
