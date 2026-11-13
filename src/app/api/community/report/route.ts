import { NextRequest, NextResponse } from 'next/server'
import { saveCommunityReport, ensureDevice } from '@/lib/scan/store-server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, rateLimitHeaders, LIMITS } from '@/lib/scan/rate-limit'
import { sendPushAlert } from '@/lib/scan/push-sender'

export const runtime = 'nodejs'

interface ReportBody {
  brand: string
  productName?: string
  region?: string
  details?: string
  deviceFingerprint?: string
}

/**
 * Broadcast the alert to the community-alert mini-service (socket.io on
 * port 3003, internal HTTP endpoint on port 3004). Server-to-server call
 * on localhost — does not go through the gateway.
 */
async function broadcastAlert(payload: {
  brand: string
  productName?: string
  region?: string
  details?: string
}): Promise<void> {
  try {
    await fetch('http://localhost:3004/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    })
  } catch (err) {
    // The alert service may not be running — log and continue without failing
    // the report submission. The report is still saved (if Supabase is up).
    console.error('[community/report] broadcast failed:', err)
  }
}

export async function POST(req: NextRequest) {
  // Rate limit — prevents spam reports.
  const ip = getClientIp(req)
  const deviceFp = req.headers.get('x-device-fingerprint') ?? 'anon'
  const limit = checkRateLimit(deviceFp, ip, LIMITS.report)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many reports. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(limit) }
    )
  }

  let body: ReportBody
  try {
    body = (await req.json()) as ReportBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.brand?.trim()) {
    return NextResponse.json({ error: 'Brand is required' }, { status: 400 })
  }

  // Always broadcast the alert (even if Supabase isn't configured) so that
  // connected clients in the same region see real-time alerts.
  await broadcastAlert({
    brand: body.brand.trim(),
    productName: body.productName?.trim() || undefined,
    region: body.region,
    details: body.details?.trim() || undefined,
  })

  // Also send web push notifications to subscribed devices in the region.
  // This runs in the background — failures don't block the response.
  sendPushAlert(
    {
      title: 'Counterfeit alert nearby',
      body: `${body.brand.trim()}${body.productName ? ` — ${body.productName.trim()}` : ''} was reported as fake${body.region ? ` in ${body.region}` : ''}.`,
      tag: 'counterfeit-alert',
    },
    body.region
  ).catch((err) => console.error('[community/report] push failed:', err))

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      usingLocalStore: true,
      broadcast: true,
      message: 'Report broadcast to nearby users. Connect Supabase to persist for the community.',
    })
  }

  let deviceId: string | null = null
  if (body.deviceFingerprint) {
    deviceId = await ensureDevice(body.deviceFingerprint, body.region)
  }

  const id = await saveCommunityReport({
    deviceId,
    brand: body.brand.trim(),
    productName: body.productName?.trim() || undefined,
    region: body.region,
    details: body.details?.trim() || undefined,
  })

  if (!id) {
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id, persisted: true, usingLocalStore: false, broadcast: true })
}
