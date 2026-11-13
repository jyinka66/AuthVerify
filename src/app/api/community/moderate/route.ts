import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface ModerateBody {
  reportId: string
  action: 'verify' | 'dismiss'
}

/**
 * POST /api/community/moderate
 *
 * Approves (verify) or dismisses a community report. Only accessible to
 * authenticated regulator users in production (RLS-protected). For now,
 * uses the service role key.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured.' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  let body: ModerateBody
  try {
    body = (await req.json()) as ModerateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.reportId || !['verify', 'dismiss'].includes(body.action)) {
    return NextResponse.json({ error: 'reportId and action (verify|dismiss) required' }, { status: 400 })
  }

  const status = body.action === 'verify' ? 'verified' : 'dismissed'
  const { error } = await supabase
    .from('community_reports')
    .update({ status })
    .eq('id', body.reportId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, reportId: body.reportId, status })
}
