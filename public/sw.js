// AuthVerify service worker — caches the app shell for offline use.
// Network-first for navigation requests and API calls; cache-first for
// static assets. Falls back to the cached app shell when offline.

const CACHE_NAME = 'authverify-v1'
const APP_SHELL = ['/', '/manifest.json', '/icon.svg', '/logo.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        // Individual asset failures are OK — they will be cached on first fetch.
      })
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Skip cross-origin requests (Supabase, OpenFoodFacts, etc.).
  if (url.origin !== self.location.origin) return

  // Skip Next.js dev HMR / chunks — they change on rebuilds.
  if (url.pathname.startsWith('/_next/webpack-hmr')) return

  // Network-first for navigation (HTML) and API requests.
  if (req.mode === 'navigate' || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {})
        return res
      }).catch(() => cached)
    )
  )
})
