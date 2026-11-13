'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker for offline / PWA support.
 * Only runs in production builds — skipped in dev to avoid caching
 * stale chunks during development.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.error('[sw] registration failed:', err))
  }, [])
  return null
}
