import { NextRequest, NextResponse } from 'next/server'
import { runQuickScan } from '@/lib/scan/ai'
import { ensureDevice, saveScan } from '@/lib/scan/store-server'
import { saveLocalScan } from '@/lib/scan/store-local'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, rateLimitHeaders, LIMITS } from '@/lib/scan/rate-limit'
import { validateAndSanitizeImage, ImageValidationError } from '@/lib/scan/image-validation'
import { checkBudgetAlerts } from '@/lib/scan/budget-alert'
import type { ProductCategory, ScanRecord } from '@/lib/scan/types'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

interface QuickScanBody {
  image: string
  mimeType?: string
  category?: ProductCategory | null
  deviceFingerprint?: string
  region?: string
}

export async function POST(req: NextRequest) {
  // Rate limit check (per-device + per-IP + global budget).
  const ip = getClientIp(req)
  const deviceFp = req.headers.get('x-device-fingerprint') ?? 'anon'
  const limit = checkRateLimit(deviceFp, ip, LIMITS.quick)
  if (!limit.allowed) {
    const message = limit.budgetExhausted
      ? 'Daily verification budget exhausted. Please try again tomorrow.'
      : 'Rate limit exceeded. Please slow down.'
    return NextResponse.json(
      { error: message, retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) },
      { status: 429, headers: rateLimitHeaders(limit) }
    )
  }

  // Check budget thresholds (fire-and-forget — logs warnings at 80%/90%).
  checkBudgetAlerts().catch(() => {})

  let body: QuickScanBody
  try {
    body = (await req.json()) as QuickScanBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.image) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 })
  }

  // Validate + sanitize the image (size, format, EXIF stripping).
  let validated
  try {
    validated = await validateAndSanitizeImage(body.image, body.mimeType)
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Image validation failed' }, { status: 400 })
  }

  try {
    const result = await runQuickScan(
      validated.base64,
      validated.mimeType,
      body.category ?? null
    )

    const supabaseOn = isSupabaseConfigured()
    let scanId: string | null = null
    if (supabaseOn && body.deviceFingerprint) {
      const deviceId = await ensureDevice(body.deviceFingerprint, body.region)
      scanId = await saveScan({
        deviceId,
        mode: 'quick',
        category: body.category ?? null,
        result,
        region: body.region,
      })
    }

    const fallbackId = scanId ?? randomUUID()
    const record: ScanRecord = {
      id: fallbackId,
      mode: 'quick',
      category: body.category ?? null,
      ...result,
      region: body.region,
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json(
      { scan: record, persisted: Boolean(scanId), usingLocalStore: !supabaseOn },
      { headers: rateLimitHeaders(limit) }
    )
  } catch (err) {
    console.error('[/api/scan/quick] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Quick scan failed' },
      { status: 500 }
    )
  }
}
