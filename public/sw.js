const CACHE_NAME = "scan-angka-v4";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];
const CACHEABLE_DESTINATIONS = new Set(["style", "script", "image", "font", "manifest"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheResponse(request, response) {
  if (!response.ok || !CACHEABLE_DESTINATIONS.has(request.destination)) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return await cacheResponse(request, response);
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/admin")) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/")) || Response.error()),
    );
    return;
  }

  if (request.destination === "script" || request.destination === "style") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      event.waitUntil(
        fetch(request)
          .then((response) => cacheResponse(request, response))
          .then(() => undefined)
          .catch(() => undefined),
      );
      return cached;
    }

    try {
      const response = await fetch(request);
      return await cacheResponse(request, response);
    } catch {
      return Response.error();
    }
  })());
});
