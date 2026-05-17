const CACHE_NAME = "clearmatte-cache-v1";
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./offline.html");
          }
          return caches.match("./");
        });
    })
  );
});
