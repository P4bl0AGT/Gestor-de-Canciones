const CACHE = 'gc-app-cache-v1';
const RUNTIME = 'gc-runtime-v1';

const BASE = self.registration.scope; // '/Gestor-de-Canciones/'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll([
      BASE,
      BASE + 'index.html',
      BASE + 'manifest.webmanifest',
      BASE + 'icons/icon-192.png',
      BASE + 'icons/icon-512.png',
    ])
    self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map(k => (k === CACHE || k === RUNTIME) ? Promise.resolve() : caches.delete(k)))
    self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req)
        const cache = await caches.open(RUNTIME)
        cache.put(req, res.clone())
        return res
      } catch (err) {
        const cache = await caches.open(CACHE)
        return (await cache.match(BASE + 'index.html')) || Response.error()
      }
    })())
    return
  }

  if (/\.(?:js|css|png|jpg|jpeg|gif|svg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME)
      const cached = await cache.match(req)
      if (cached) return cached
      const res = await fetch(req)
      cache.put(req, res.clone())
      return res
    })())
  }
})
