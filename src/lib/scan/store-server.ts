import { createServiceRoleClient } from '@/lib/supabase/server'
import type {
  ProductCategory,
  ReferenceImage,
  ScanResult,
  ScanMode,
  ScanRecord,
} from './types'

/**
 * Server-side persistence. All functions gracefully no-op (return null/empty)
 * when Supabase is not configured, so the API routes work without a live DB.
 */

const TABLE_DEVICES = 'devices'
const TABLE_SCANS = 'scans'
const TABLE_FLAGS = 'scan_flags'
const TABLE_REFERENCE_CACHE = 'reference_cache'
const TABLE_COMMUNITY = 'community_reports'

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export async function ensureDevice(
  deviceFingerprint: string,
  region?: string
): Promise<string | null> {
  const supabase = createServiceRoleClient()
  if (!supabase) return null

  // Try to find existing.
  const { data: existing } = await supabase
    .from(TABLE_DEVICES)
    .select('id')
    .eq('device_fingerprint', deviceFingerprint)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from(TABLE_DEVICES)
      .update({ last_seen_at: new Date().toISOString(), region: region ?? null })
      .eq('id', existing.id)
    return existing.id
  }

  // Insert new device.
  const { data, error } = await supabase
    .from(TABLE_DEVICES)
    .insert({
      device_fingerprint: deviceFingerprint,
      region: region ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[store] ensureDevice failed:', error?.message)
    return null
  }
  return data.id
}

// ---------------------------------------------------------------------------
// Scans
// ---------------------------------------------------------------------------

export async function saveScan(params: {
  deviceId: string | null
  mode: ScanMode
  category: ProductCategory | null
  result: ScanResult
  suspectImagePath?: string
  region?: string
}): Promise<string | null> {
  const supabase = createServiceRoleClient()
  if (!supabase || !params.deviceId) return null

  const { data, error } = await supabase
    .from(TABLE_SCANS)
    .insert({
      device_id: params.deviceId,
      mode: params.mode,
      category: params.category,
      brand_detected: params.result.brandDetected ?? null,
      product_name_detected: params.result.productNameDetected ?? null,
      pack_size_detected: params.result.packSizeDetected ?? null,
      verdict: params.result.verdict,
      confidence_score: params.result.confidenceScore,
      reasoning: params.result.reasoning,
      suspect_image_path: params.suspectImagePath ?? null,
      reference_images_json: params.result.referenceImages ?? null,
      region: params.region ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[store] saveScan failed:', error?.message)
    return null
  }

  const scanId = data.id

  // Insert flags.
  if (params.result.flags.length > 0) {
    await supabase.from(TABLE_FLAGS).insert(
      params.result.flags.map((f) => ({
        scan_id: scanId,
        kind: f.kind,
        category: f.category,
        description: f.description,
        severity: f.severity,
      }))
    )
  }

  return scanId
}

export async function listScans(
  deviceId: string | null,
  limit = 20,
  offset = 0
): Promise<ScanRecord[]> {
  const supabase = createServiceRoleClient()
  if (!supabase || !deviceId) return []

  const { data, error } = await supabase
    .from(TABLE_SCANS)
    .select('id, mode, category, brand_detected, product_name_detected, pack_size_detected, verdict, confidence_score, reasoning, suspect_image_path, reference_images_json, region, created_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error || !data) {
    console.error('[store] listScans failed:', error?.message)
    return []
  }

  // Fetch flags for these scans in one round-trip.
  const scanIds = data.map((s) => s.id)
  let flagsByScan: Record<string, Array<{ kind: string; category: string; description: string; severity: string }>> = {}
  if (scanIds.length > 0) {
    const { data: flags } = await supabase
      .from(TABLE_FLAGS)
      .select('scan_id, kind, category, description, severity')
      .in('scan_id', scanIds)
    if (flags) {
      for (const f of flags) {
        const arr = flagsByScan[f.scan_id] ?? []
        arr.push(f)
        flagsByScan[f.scan_id] = arr
      }
    }
  }

  return data.map((row) => mapRowToRecord(row, flagsByScan[row.id] ?? []))
}

export async function getScan(
  scanId: string
): Promise<ScanRecord | null> {
  const supabase = createServiceRoleClient()
  if (!supabase) return null

  const { data: row, error } = await supabase
    .from(TABLE_SCANS)
    .select('id, mode, category, brand_detected, product_name_detected, pack_size_detected, verdict, confidence_score, reasoning, suspect_image_path, reference_images_json, region, created_at')
    .eq('id', scanId)
    .maybeSingle()

  if (error || !row) return null

  const { data: flags } = await supabase
    .from(TABLE_FLAGS)
    .select('kind, category, description, severity')
    .eq('scan_id', scanId)

  return mapRowToRecord(row, flags ?? [])
}

export async function deleteScan(scanId: string): Promise<boolean> {
  const supabase = createServiceRoleClient()
  if (!supabase) return false
  const { error } = await supabase.from(TABLE_SCANS).delete().eq('id', scanId)
  return !error
}

// ---------------------------------------------------------------------------
// Reference cache
// ---------------------------------------------------------------------------

export async function getCachedReferences(
  brand: string,
  productName?: string
): Promise<ReferenceImage[] | null> {
  const supabase = createServiceRoleClient()
  if (!supabase) return null

  let query = supabase
    .from(TABLE_REFERENCE_CACHE)
    .select('image_url, source_url, source_type, credibility_score, caption')
    .eq('brand', brand)
    .gt('expires_at', new Date().toISOString())
    .order('credibility_score', { ascending: false })
    .limit(5)

  if (productName) query = query.eq('product_name', productName)

  const { data, error } = await query
  if (error || !data || data.length === 0) return null

  return data.map((r) => ({
    imageUrl: r.image_url,
    sourceUrl: r.source_url ?? r.image_url,
    sourceType: r.source_type as ReferenceImage['sourceType'],
    credibilityScore: r.credibility_score,
    caption: r.caption ?? undefined,
  }))
}

export async function cacheReferences(
  brand: string,
  productName: string | null,
  references: ReferenceImage[]
): Promise<void> {
  const supabase = createServiceRoleClient()
  if (!supabase || references.length === 0) return

  // Replace existing cache for this brand/product.
  const match = productName
    ? { brand, product_name: productName }
    : { brand }
  await supabase.from(TABLE_REFERENCE_CACHE).delete().match(match)

  await supabase.from(TABLE_REFERENCE_CACHE).insert(
    references.map((r) => ({
      brand,
      product_name: productName,
      image_url: r.imageUrl,
      source_url: r.sourceUrl,
      source_type: r.sourceType,
      credibility_score: r.credibilityScore,
      caption: r.caption ?? null,
    }))
  )
}

// ---------------------------------------------------------------------------
// Community reports
// ---------------------------------------------------------------------------

export async function saveCommunityReport(params: {
  deviceId: string | null
  brand: string
  productName?: string
  region?: string
  details?: string
}): Promise<string | null> {
  const supabase = createServiceRoleClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from(TABLE_COMMUNITY)
    .insert({
      brand: params.brand,
      product_name: params.productName ?? null,
      region: params.region ?? null,
      reporter_device_id: params.deviceId,
      details_json: params.details ? { note: params.details } : null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[store] saveCommunityReport failed:', error?.message)
    return null
  }
  return data.id
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ScanRow {
  id: string
  mode: string
  category: string | null
  brand_detected: string | null
  product_name_detected: string | null
  pack_size_detected: string | null
  verdict: string
  confidence_score: number
  reasoning: string
  suspect_image_path: string | null
  reference_images_json: unknown
  region: string | null
  created_at: string
}

interface FlagRow {
  kind: string
  category: string
  description: string
  severity: string
}

function mapRowToRecord(row: ScanRow, flags: FlagRow[]): ScanRecord {
  const references = Array.isArray(row.reference_images_json)
    ? (row.reference_images_json as ReferenceImage[])
    : undefined

  return {
    id: row.id,
    mode: row.mode as ScanMode,
    category: (row.category as ProductCategory) ?? null,
    brandDetected: row.brand_detected ?? undefined,
    productNameDetected: row.product_name_detected ?? undefined,
    packSizeDetected: row.pack_size_detected ?? undefined,
    verdict: row.verdict as ScanResult['verdict'],
    confidenceScore: row.confidence_score,
    reasoning: row.reasoning,
    suspectImageUrl: row.suspect_image_path ?? undefined,
    referenceImages: references,
    region: row.region ?? undefined,
    createdAt: row.created_at,
    flags: flags.map((f) => ({
      kind: f.kind as 'red_flag' | 'positive_indicator',
      category: f.category,
      description: f.description,
      severity: f.severity as 'low' | 'medium' | 'high',
    })),
  }
}
