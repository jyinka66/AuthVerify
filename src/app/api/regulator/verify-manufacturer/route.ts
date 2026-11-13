import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/regulator/verify-manufacturer
 *
 * Lists manufacturers pending verification (verified = false).
 * Used by the regulator dashboard's manufacturer verification queue.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ manufacturers: [], configured: false })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) return NextResponse.json({ manufacturers: [], configured: false })

  const { data, error } = await supabase
    .from('manufacturers')
    .select('id, company_name, country, contact_email, phone, regulatory_license_number, website, verified, created_at')
    .eq('verified', false)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[verify-manufacturer] list failed:', error.message)
    return NextResponse.json({ manufacturers: [] })
  }

  // Also get a count of products each pending manufacturer has registered.
  const manufacturersWithCounts = await Promise.all(
    (data ?? []).map(async (m) => {
      const { count } = await supabase
        .from('manufacturer_products')
        .select('id', { count: 'exact', head: true })
        .eq('manufacturer_id', m.id)
      return { ...m, productCount: count ?? 0 }
    })
  )

  return NextResponse.json({ manufacturers: manufacturersWithCounts, configured: true })
}

interface VerifyBody {
  manufacturerId: string
  verified: boolean
}

/**
 * POST /api/regulator/verify-manufacturer
 *
 * Approves (verified=true) or rejects (verified=false) a manufacturer.
 * In production, this should be protected so only admin/regulator users
 * can call it. For now, it requires the service role key (server-side).
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured.' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  let body: VerifyBody
  try {
    body = (await req.json()) as VerifyBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.manufacturerId || typeof body.verified !== 'boolean') {
    return NextResponse.json({ error: 'manufacturerId and verified (boolean) required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('manufacturers')
    .update({ verified: body.verified })
    .eq('id', body.manufacturerId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    manufacturerId: body.manufacturerId,
    verified: body.verified,
  })
}
