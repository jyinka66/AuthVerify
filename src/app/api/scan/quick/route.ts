import { NextRequest, NextResponse } from 'next/server'
import { runQuickScan } from '@/lib/scan/ai'
import { ensureDevice, saveScan } from '@/lib/scan/store-server'
import { saveLocalScan } from '@/lib/scan/store-local'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type { ProductCategory, ScanRecord } from '@/lib/scan/types'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

interface QuickScanBody {
  image: string        // data URL or raw base64
  mimeType?: string
  category?: ProductCategory | null
  deviceFingerprint?: string
  region?: string
}

function parseImage(input: string, fallbackMime?: string): { base64: string; mimeType: string } {
  const dataUrlMatch = input.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (dataUrlMatch) {
    return { mimeType: dataUrlMatch[1], base64: dataUrlMatch[2] }
  }
  if (!fallbackMime) throw new Error('Missing mimeType for raw base64 image')
  return { mimeType: fallbackMime, base64: input }
}

export async function POST(req: NextRequest) {
  let body: QuickScanBody
  try {
    body = (await req.json()) as QuickScanBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.image) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseImage(body.image, body.mimeType)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid image' },
      { status: 400 }
    )
  }

  try {
    const result = await runQuickScan(
      parsed.base64,
      parsed.mimeType,
      body.category ?? null
    )

    // Persist (Supabase if configured, else client-side localStorage via response).
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

    // If Supabase isn't configured, generate a local id so the client can save it.
    const fallbackId = scanId ?? randomUUID()
    const record: ScanRecord = {
      id: fallbackId,
      mode: 'quick',
      category: body.category ?? null,
      ...result,
      region: body.region,
      createdAt: new Date().toISOString(),
    }

    // Always return the record; the client decides whether to save locally.
    return NextResponse.json({
      scan: record,
      persisted: Boolean(scanId),
      usingLocalStore: !supabaseOn,
    })
  } catch (err) {
    console.error('[/api/scan/quick] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Quick scan failed' },
      { status: 500 }
    )
  }
}
