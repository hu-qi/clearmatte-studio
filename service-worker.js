const CACHE_NAME = "clearmatte-cache-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css",
  "./app.js",
  "./favicon.ico",
  "./site.webmanifest",
  "./imgs/logo.png",
  "./imgs/clearmatte_horizontal_logo.png",
  "./imgs/favicon_io/apple-touch-icon.png",
  "./imgs/favicon_io/favicon-16x16.png",
  "./imgs/favicon_io/favicon-32x32.png",
  "./imgs/favicon_io/android-chrome-192x192.png",
  "./imgs/favicon_io/android-chrome-512x512.png",
];
const NETWORK_FIRST_FILES = new Set(["/", "/index.html", "/app.js", "/styles.css"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate" || shouldUseNetworkFirst(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

function shouldUseNetworkFirst(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return NETWORK_FIRST_FILES.has(url.pathname);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match("./offline.html");
    return caches.match("./");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch {
    if (request.mode === "navigate") return caches.match("./offline.html");
    return caches.match("./");
  }
}

async function cacheResponse(request, response) {
  if (!response || response.status !== 200 || response.type !== "basic") return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}
