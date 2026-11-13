import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { ensureDevice } from '@/lib/scan/store-server'

export const runtime = 'nodejs'

interface FeedbackBody {
  scanId?: string
  deviceFingerprint?: string
  feedback: 'correct' | 'incorrect' | 'partially_correct'
  notes?: string
}

/**
 * POST /api/feedback
 *
 * Stores user feedback on a scan verdict ("this was correct" / "this was wrong").
 * Used to improve model accuracy over time and surface community-verified verdicts.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    // Accept gracefully — no persistence when Supabase isn't configured.
    return NextResponse.json({ ok: true, persisted: false })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) return NextResponse.json({ ok: true, persisted: false })

  let body: FeedbackBody
  try {
    body = (await req.json()) as FeedbackBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.feedback || !['correct', 'incorrect', 'partially_correct'].includes(body.feedback)) {
    return NextResponse.json({ error: 'Valid feedback value required' }, { status: 400 })
  }

  let deviceId: string | null = null
  if (body.deviceFingerprint) {
    deviceId = await ensureDevice(body.deviceFingerprint)
  }

  const { error } = await supabase.from('verdict_feedback').insert({
    scan_id: body.scanId ?? null,
    device_id: deviceId,
    feedback: body.feedback,
    notes: body.notes?.trim() || null,
  })

  if (error) {
    console.error('[feedback] insert failed:', error.message)
    return NextResponse.json({ error: 'Failed to store feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, persisted: true })
}
