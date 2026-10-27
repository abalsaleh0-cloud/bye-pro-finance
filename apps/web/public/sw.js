const CACHE_VERSION = "bye-pro-finance-v2";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icons/icon.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("bye-pro-finance-") && !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL)),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      }).catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (!response || response.status !== 200 || response.type !== "basic") return response;
      const copy = response.clone();
      event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)));
      return response;
    })),
  );
});


self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || "" }; }
    const title = typeof payload.title === "string" ? payload.title : "BYE PRO";
    const options = {
      body: typeof payload.body === "string" ? payload.body : "لديك إشعار جديد",
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      tag: typeof payload.tag === "string" ? payload.tag : "bye-pro-notification",
      renotify: false,
      data: { url: typeof payload.url === "string" ? payload.url : "/" },
      dir: "auto",
      lang: "ar",
    };
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const hasVisibleWindow = windows.some((client) => client.visibilityState === "visible");
    if (hasVisibleWindow) {
      for (const client of windows) client.postMessage({ type: "BYE_PRO_PUSH", payload });
      return;
    }
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(destination);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(destination);
  })());
});
