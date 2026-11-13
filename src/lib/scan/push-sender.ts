import webpush from 'web-push'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Web Push notification sender.
 *
 * Sends push notifications to all subscribed devices (optionally filtered
 * by region) when a counterfeit alert is broadcast. Uses the web-push
 * library with VAPID keys from environment variables.
 */

let configured = false

function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@authverify.app'

  if (!publicKey || !privateKey) {
    // VAPID keys not configured — push notifications disabled.
    return
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
}

/**
 * Send a push notification to all subscriptions (optionally in a specific region).
 * Called by the community/report route after broadcasting via socket.io.
 */
export async function sendPushAlert(
  payload: PushPayload,
  region?: string
): Promise<{ sent: number; failed: number }> {
  ensureConfigured()
  if (!configured) return { sent: 0, failed: 0 }

  const supabase = createServiceRoleClient()
  if (!supabase) return { sent: 0, failed: 0 }

  // Query subscriptions — optionally filtered by region.
  let query = supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh_key, auth_key')
    .limit(500)

  if (region) {
    query = query.eq('region', region)
  }

  const { data: subscriptions, error } = await query
  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag || 'counterfeit-alert',
    url: payload.url || '/',
  })

  let sent = 0
  let failed = 0
  const endpointsToRemove: string[] = []

  // Send push to each subscription.
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          },
          message
        )
        sent++
      } catch (err) {
        failed++
        // If the subscription is expired (410 Gone) or invalid (404), remove it.
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          endpointsToRemove.push(sub.endpoint)
        }
      }
    })
  )

  // Clean up expired subscriptions.
  if (endpointsToRemove.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', endpointsToRemove)
  }

  return { sent, failed }
}
