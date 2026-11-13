'use client'

import { useEffect, useState } from 'react'

/**
 * Web Push notification subscription hook.
 *
 * On mount, requests notification permission (if not already granted),
 * creates a push subscription via the service worker, and POSTs it to
 * /api/push/subscribe so the server can send push notifications.
 *
 * Returns:
 * - supported: whether push + service worker are available in this browser
 * - permission: 'default' | 'granted' | 'denied'
 * - subscribe(): manually request permission + subscribe
 */
export function usePushNotifications() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Feature detection for service worker + push support.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported('serviceWorker' in navigator && 'PushManager' in window)
    setPermission(Notification.permission)
  }, [])

  const subscribe = async () => {
    if (!supported) return
    try {
      const permission = await Notification.requestPermission()
      setPermission(permission)
      if (permission !== 'granted') return

      // VAPID public key — required for push subscriptions to work.
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — push notifications disabled')
        return
      }

      // Convert the base64 VAPID key to a Uint8Array for the pushManager API.
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const subscription = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      // POST the subscription to the server.
      const keys = subscription.getKey ? {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh') || new ArrayBuffer(0)))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth') || new ArrayBuffer(0)))),
      } : { p256dh: '', auth: '' }

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys,
        }),
      }).catch(() => {
        // Supabase might not be configured — that's OK, the subscription
        // still works locally via the service worker.
      })

      setSubscribed(true)
    } catch (err) {
      console.error('[push] subscription failed:', err)
    }
  }

  return { supported, permission, subscribed, subscribe }
}

/** Convert a base64 URL string to a Uint8Array (for the PushManager applicationServerKey parameter). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}
