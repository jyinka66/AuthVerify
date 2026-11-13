import { NextRequest, NextResponse } from 'next/server'
import { listScans, ensureDevice } from '@/lib/scan/store-server'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const deviceFingerprint = req.headers.get('x-device-fingerprint') ?? req.nextUrl.searchParams.get('device') ?? ''
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '20')
  const offset = Number(req.nextUrl.searchParams.get('offset') ?? '0')

  if (!isSupabaseConfigured()) {
    // Client falls back to localStorage — return empty so the client knows.
    return NextResponse.json({ scans: [], usingLocalStore: true })
  }

  if (!deviceFingerprint) {
    return NextResponse.json({ scans: [], usingLocalStore: false })
  }

  const region = req.nextUrl.searchParams.get('region') ?? undefined
  const deviceId = await ensureDevice(deviceFingerprint, region)
  const scans = await listScans(deviceId, limit, offset)

  return NextResponse.json({ scans, usingLocalStore: false })
}
