// Mi Centro — Service Worker
// Estrategia:
//   - HTML (navigate): network-first con fallback a caché y luego /offline
//   - Estáticos (_next/static, /icon*, fuentes): stale-while-revalidate
//   - API (/api): siempre red. No cacheamos (datos del usuario, sesión)

const VERSION = "v1.1.0";
const SHELL_CACHE = `mc-shell-${VERSION}`;
const ASSETS_CACHE = `mc-assets-${VERSION}`;

const SHELL_URLS = ["/", "/offline", "/hoy", "/finanzas", "/rutinas", "/dieta"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Pre-cachear shell routes — si alguna falla, no abortar la instalación.
      await Promise.allSettled(
        SHELL_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("mc-") && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Mismo origen sólo. Cross-origin (fonts.googleapis, API) pasa directo.
  if (url.origin !== self.location.origin) return;

  // API: bypass total — siempre red, sin caché.
  if (url.pathname.startsWith("/api/")) return;

  // Navegación HTML: network-first con fallback a caché → /offline.
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // Estáticos Next + recursos públicos: stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/)
  ) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    const offline = await cache.match("/offline");
    if (offline) return offline;
    return new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(ASSETS_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// ─── Push (placeholder hasta que entre el módulo de reminders) ──────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Mi Centro", body: event.data.text() };
  }
  const title = payload.title ?? "Mi Centro";
  const options = {
    body: payload.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data ?? {},
    tag: payload.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/hoy";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
