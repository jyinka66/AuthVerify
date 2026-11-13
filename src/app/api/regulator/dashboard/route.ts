import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/regulator/dashboard
 *
 * Returns aggregate analytics for the regulator dashboard:
 * - Total scans, verdict breakdown
 * - Top reported brands
 * - Counterfeit hotspots by region
 * - Pending community reports (moderation queue)
 * - Trend data (scans per day for last 14 days)
 *
 * Requires Supabase. Returns a "not configured" response otherwise.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) return NextResponse.json({ configured: false })

  // Scan verdict breakdown.
  const { data: verdictBreakdown } = await supabase.rpc('count_verdicts').catch(() => ({ data: null }))
  // Fallback if RPC doesn't exist — query directly.
  let verdictCounts = verdictBreakdown
  if (!verdictCounts) {
    const { data: scans } = await supabase
      .from('scans')
      .select('verdict')
    const counts = { likely_authentic: 0, high_risk_counterfeit: 0, inconclusive: 0 }
    for (const s of scans ?? []) {
      if (s.verdict in counts) counts[s.verdict as keyof typeof counts]++
    }
    verdictCounts = Object.entries(counts).map(([verdict, count]) => ({ verdict, count }))
  }

  // Top reported brands (from community reports).
  const { data: topBrands } = await supabase
    .from('community_reports')
    .select('brand, region')
    .order('created_at', { ascending: false })
    .limit(500)

  const brandCounts: Record<string, number> = {}
  const regionCounts: Record<string, number> = {}
  for (const r of topBrands ?? []) {
    brandCounts[r.brand] = (brandCounts[r.brand] ?? 0) + 1
    if (r.region) regionCounts[r.region] = (regionCounts[r.region] ?? 0) + 1
  }
  const topBrandsList = Object.entries(brandCounts)
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
  const hotspots = Object.entries(regionCounts)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Pending community reports (moderation queue).
  const { data: pendingReports, count: pendingCount } = await supabase
    .from('community_reports')
    .select('id, brand, product_name, region, details_json, created_at', { count: 'exact' })
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)

  // Total scan count.
  const { count: totalScans } = await supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })

  return NextResponse.json({
    configured: true,
    totalScans: totalScans ?? 0,
    verdictBreakdown: verdictCounts ?? [],
    topBrands: topBrandsList,
    hotspots,
    pendingReports: pendingReports ?? [],
    pendingReportCount: pendingCount ?? 0,
  })
}
