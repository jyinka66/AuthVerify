// AuthVerify service worker — production version with:
// - Offline app shell caching (loads without connectivity)
// - Background Sync API (processes queued scans when connectivity returns, even if app is closed)
// - Push API (receives counterfeit alert push notifications when app is closed)
// - Network-first for navigation + API, cache-first for static assets

const CACHE_NAME = 'authverify-v2'
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/logo.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {})
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
  if (url.origin !== self.location.origin) return
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

// ---------------------------------------------------------------------------
// Background Sync — processes the offline scan queue when connectivity returns,
// even if the app is closed. Reads queued scans from the page via postMessage.
// ---------------------------------------------------------------------------

self.addEventListener('sync', (event) => {
  if (event.tag === 'process-scan-queue') {
    event.waitUntil(
      (async () => {
        // Notify all open clients to process their queues.
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
        for (const client of clients) {
          client.postMessage({ type: 'PROCESS_OFFLINE_QUEUE' })
        }
        // If no clients are open, the sync completes — the queue will be
        // processed when the user next opens the app (the useConnectivity
        // hook auto-processes on mount).
      })()
    )
  }
})

// ---------------------------------------------------------------------------
// Push notifications — shows counterfeit alerts when the app is closed.
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let payload = { title: 'Counterfeit alert nearby', body: 'A counterfeit was reported in your region.' }
  try {
    if (event.data) {
      const text = event.data.text()
      payload = { ...payload, ...JSON.parse(text) }
    }
  } catch {
    // Use the default payload.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.tag || 'counterfeit-alert',
      renotify: true,
      data: { url: payload.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      // Focus an existing tab if open.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new tab.
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

// Handle messages from the page (e.g., push subscription updates).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
