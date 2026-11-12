import { NextRequest, NextResponse } from 'next/server'
import { saveCommunityReport, ensureDevice } from '@/lib/scan/store-server'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface ReportBody {
  brand: string
  productName?: string
  region?: string
  details?: string
  deviceFingerprint?: string
}

export async function POST(req: NextRequest) {
  let body: ReportBody
  try {
    body = (await req.json()) as ReportBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.brand?.trim()) {
    return NextResponse.json({ error: 'Brand is required' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    // Accept the report locally so the UX works even without a backend.
    return NextResponse.json({
      ok: true,
      persisted: false,
      usingLocalStore: true,
      message: 'Report recorded locally. Connect Supabase to share with the community.',
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

  return NextResponse.json({ ok: true, id, persisted: true, usingLocalStore: false })
}
