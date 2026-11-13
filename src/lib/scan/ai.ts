import ZAI from 'z-ai-web-dev-sdk'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { createHash } from 'crypto'
import type {
  ProductCategory,
  ReferenceImage,
  ReferenceSourceType,
  ScanResult,
} from './types'
import {
  buildQuickScanPrompt,
  buildDeepComparePrompt,
  buildExtractionPrompt,
} from './prompts'
import { extractJson } from './json'
import { lookupRegisteredProduct } from './manufacturer-store'
import type { SecurityFeature, FakeIndicator } from './manufacturer-types'
import { createServiceRoleClient } from '@/lib/supabase/server'

const execFileAsync = promisify(execFile)
const CLI_BUFFER = 20 * 1024 * 1024 // 20MB — image search responses can be large

// ---------------------------------------------------------------------------
// SDK singleton
// ---------------------------------------------------------------------------

let zaiPromise: Promise<ZAI> | null = null
async function getZai(): Promise<ZAI> {
  if (!zaiPromise) zaiPromise = ZAI.create() as Promise<ZAI>
  return zaiPromise
}

// ---------------------------------------------------------------------------
// Types returned by the CLI tools
// ---------------------------------------------------------------------------

interface ImageSearchResult {
  success: boolean
  query?: string
  count?: number
  results?: Array<{
    original_url: string
    caption?: string
    source?: string
    original_width?: string
    original_height?: string
  }>
  error?: string
}

interface WebSearchResult {
  success?: boolean
  results?: Array<{
    title?: string
    url?: string
    snippet?: string
    source?: string
  }>
  data?: Array<{
    title?: string
    url?: string
    snippet?: string
    source?: string
  }>
  error?: string
}

// ---------------------------------------------------------------------------
// CLI invocations (image-search + web_search)
// ---------------------------------------------------------------------------

/**
 * The z-ai CLI prints banner lines (e.g. "🚀 Initializing Z-AI SDK...")
 * before and sometimes after the actual JSON output. This helper locates
 * the first complete JSON value (object or array) using bracket matching
 * and returns just that substring, ignoring any banners or trailing text.
 */
function extractFirstJson(stdout: string): string {
  const start = stdout.search(/[{[]/)
  if (start === -1) return stdout.trim()
  const open = stdout[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < stdout.length; i++) {
    const ch = stdout[i]
    if (inString) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return stdout.slice(start, i + 1)
    }
  }
  // No matching close found — return the raw slice and let JSON.parse fail loudly.
  return stdout.slice(start).trim()
}

/** Run `z-ai image-search` and return parsed JSON (with retry + cost tracking). */
export async function runImageSearch(
  query: string,
  count = 5,
  region = 'us'
): Promise<ImageSearchResult> {
  try {
    const { stdout } = await withRetry(async () => {
      trackCost('image_search')
      return execFileAsync(
        'z-ai',
        ['image-search', '-q', query, '-c', String(count), '--gl', region, '--no-rank'],
        { maxBuffer: CLI_BUFFER, timeout: 120000 }
      )
    }, 'image-search')
    const json = extractFirstJson(stdout)
    return JSON.parse(json) as ImageSearchResult
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[image-search] failed:', message)
    return { success: false, error: message, results: [] }
  }
}

/** Run `z-ai function -n web_search` and return parsed JSON (with retry + cost tracking). */
export async function runWebSearch(query: string, num = 6): Promise<WebSearchResult> {
  try {
    const { stdout } = await withRetry(async () => {
      trackCost('web_search')
      return execFileAsync(
        'z-ai',
        ['function', '-n', 'web_search', '-a', JSON.stringify({ query, num })],
        { maxBuffer: CLI_BUFFER, timeout: 60000 }
      )
    }, 'web-search')
    const json = extractFirstJson(stdout)
    const parsed = JSON.parse(json) as
      | Array<{ url?: string; name?: string; snippet?: string; host_name?: string }>
      | WebSearchResult
    if (Array.isArray(parsed)) {
      return {
        success: true,
        results: parsed.map((r) => ({
          title: r.name,
          url: r.url,
          snippet: r.snippet,
          source: r.host_name,
        })),
      }
    }
    return parsed
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[web_search] failed:', message)
    return { success: false, error: message, results: [] }
  }
}

// ---------------------------------------------------------------------------
// Reference-image source credibility
// ---------------------------------------------------------------------------

function classifySource(sourceUrl: string, sourceName?: string): {
  sourceType: ReferenceSourceType
  credibilityScore: number
} {
  const url = sourceUrl.toLowerCase()
  const name = (sourceName || '').toLowerCase()
  const joined = `${url} ${name}`

  if (/(nafdac|fda\.gov|mhra|who\.int|ema\.europa|tga\.gov|health\.gov|regulator|regulatory)/.test(joined)) {
    return { sourceType: 'regulatory', credibilityScore: 95 }
  }
  if (/(manufacturer|official|brand\.com|\.com\/official|corporate)/.test(joined)) {
    return { sourceType: 'manufacturer', credibilityScore: 90 }
  }
  // Heuristic: known official brand domains often match brandname.com
  if (/^https?:\/\/[^/]*(brand|official|corp)/.test(url)) {
    return { sourceType: 'manufacturer', credibilityScore: 85 }
  }
  if (/(jumia|konga|amazon|ebay|walmart|aliexpress|alibaba|flipkart|shoprite)/.test(joined)) {
    return { sourceType: 'marketplace', credibilityScore: 45 }
  }
  if (/(wikipedia|wikimedia)/.test(joined)) {
    return { sourceType: 'retailer', credibilityScore: 60 }
  }
  return { sourceType: 'unknown', credibilityScore: 50 }
}

/** Convert raw image-search hits into typed ReferenceImage objects. */
export function toReferenceImages(hit: ImageSearchResult): ReferenceImage[] {
  if (!hit.success || !hit.results) return []
  return hit.results.slice(0, 5).map((r) => {
    const { sourceType, credibilityScore } = classifySource(
      r.original_url,
      r.source
    )
    return {
      imageUrl: r.original_url,
      sourceUrl: r.original_url,
      sourceType,
      credibilityScore,
      caption: r.caption,
    }
  })
}

// ---------------------------------------------------------------------------
// Retry wrapper + circuit breaker
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3
const circuitState = { failures: 0, trippedUntil: 0 }

/** Check if the AI circuit breaker is tripped (too many consecutive failures). */
export function isCircuitTripped(): boolean {
  return Date.now() < circuitState.trippedUntil
}

/** Reset the circuit breaker after a successful call. */
function recordSuccess() {
  circuitState.failures = 0
  circuitState.trippedUntil = 0
}

/** Record a failure and trip the breaker after MAX_RETRIES consecutive failures. */
function recordFailure() {
  circuitState.failures++
  if (circuitState.failures >= MAX_RETRIES) {
    // Trip for 60 seconds.
    circuitState.trippedUntil = Date.now() + 60_000
    console.error('[ai] circuit breaker tripped for 60s after', circuitState.failures, 'failures')
  }
}

/** Retry wrapper with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  if (isCircuitTripped()) {
    throw new Error('AI service temporarily unavailable (circuit breaker tripped). Try again in a minute.')
  }
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn()
      recordSuccess()
      return result
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[ai] ${label} attempt ${attempt}/${MAX_RETRIES} failed:`, msg)
      if (attempt < MAX_RETRIES) {
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000)
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
  }
  recordFailure()
  throw lastError instanceof Error ? lastError : new Error(`${label} failed after ${MAX_RETRIES} retries`)
}

// ---------------------------------------------------------------------------
// VLM response caching (content-hash based)
// ---------------------------------------------------------------------------

const vlmCache = new Map<string, { result: ScanResult; expiresAt: number }>()
const VLM_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours in-memory

function vlmCacheKey(imageBase64: string, prompt: string): string {
  return createHash('sha256').update(imageBase64).update(prompt).digest('hex').slice(0, 32)
}

function getCachedVlm(key: string): ScanResult | null {
  const entry = vlmCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    vlmCache.delete(key)
    return null
  }
  return entry.result
}

function setCachedVlm(key: string, result: ScanResult) {
  if (vlmCache.size > 500) {
    const now = Date.now()
    for (const [k, v] of vlmCache) {
      if (now > v.expiresAt) vlmCache.delete(k)
    }
  }
  vlmCache.set(key, { result, expiresAt: Date.now() + VLM_CACHE_TTL_MS })

  // Also persist to the vlm_cache table for cross-instance sharing (fire-and-forget).
  const supabase = createServiceRoleClient()
  if (supabase) {
    supabase.from('vlm_cache').upsert({
      hash: key,
      result_json: result,
      prompt_version: 'v1',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).then(undefined, () => {})
  }
}

/** Check the Supabase vlm_cache table for a persistent cache hit (cross-instance). */
async function getDbCachedVlm(key: string): Promise<ScanResult | null> {
  const supabase = createServiceRoleClient()
  if (!supabase) return null
  try {
    const { data } = await supabase
      .from('vlm_cache')
      .select('result_json')
      .eq('hash', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (data?.result_json) {
      return data.result_json as unknown as ScanResult
    }
  } catch {
    // Table might not exist yet — ignore.
  }
  return null
}

// ---------------------------------------------------------------------------
// Cost tracking (estimated, per call)
// ---------------------------------------------------------------------------

const COST_PER_VLM_CALL = 0.02 // estimated USD per VLM call
const COST_PER_WEB_SEARCH = 0.005
const COST_PER_IMAGE_SEARCH = 0.01

let totalEstimatedCost = 0

export function getEstimatedCost(): number {
  return totalEstimatedCost
}

function trackCost(service: 'vlm' | 'web_search' | 'image_search' | 'llm', count = 1) {
  const costs = {
    vlm: COST_PER_VLM_CALL,
    web_search: COST_PER_WEB_SEARCH,
    image_search: COST_PER_IMAGE_SEARCH,
    llm: COST_PER_VLM_CALL,
  }
  const cost = costs[service] * count
  totalEstimatedCost += cost

  // Persist to the cost_log table (fire-and-forget, non-blocking).
  const supabase = createServiceRoleClient()
  if (supabase) {
    supabase.from('cost_log').insert({
      service,
      estimated_cost_usd: cost,
    }).then(undefined, () => {})
  }
}

// ---------------------------------------------------------------------------
// VLM calls via SDK (with retry + caching)
// ---------------------------------------------------------------------------

/** Quick Scan: single-frame authenticity analysis (with caching + retry). */
export async function runQuickScan(
  imageBase64: string,
  mimeType: string,
  category: ProductCategory | null
): Promise<ScanResult> {
  const prompt = buildQuickScanPrompt(category)
  const cacheKey = vlmCacheKey(imageBase64, prompt)
  const cached = getCachedVlm(cacheKey)
  if (cached) {
    console.log('[ai] quick scan cache hit (memory)')
    return cached
  }

  // Check the database cache (cross-instance sharing).
  const dbCached = await getDbCachedVlm(cacheKey)
  if (dbCached) {
    console.log('[ai] quick scan cache hit (database)')
    setCachedVlm(cacheKey, dbCached) // populate in-memory cache
    return dbCached
  }

  const zai = await getZai()
  const dataUrl = `data:${mimeType};base64,${imageBase64}`

  const response = await withRetry(async () => {
    trackCost('vlm')
    return zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })
  }, 'quick-scan-vlm')

  const content = response.choices[0]?.message?.content ?? ''
  const parsed = normalizeResult(extractJson<ScanResult>(content))
  setCachedVlm(cacheKey, parsed)
  return parsed
}

/** Deep Compare step 1: extract brand/product from the suspect photo. */
export interface ExtractedInfo {
  brand: string | null
  productName: string | null
  packSize: string | null
  category: ProductCategory | null
  visibleText: string | null
}

export async function extractProductInfo(
  imageBase64: string,
  mimeType: string
): Promise<ExtractedInfo> {
  const zai = await getZai()
  const prompt = buildExtractionPrompt()
  const dataUrl = `data:${mimeType};base64,${imageBase64}`

  const response = await withRetry(async () => {
    trackCost('vlm')
    return zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })
  }, 'extract-product-info')

  const content = response.choices[0]?.message?.content ?? ''
  try {
    const parsed = extractJson<ExtractedInfo>(content)
    return {
      brand: parsed.brand ?? null,
      productName: parsed.productName ?? null,
      packSize: parsed.packSize ?? null,
      category: (parsed.category as ProductCategory) ?? null,
      visibleText: parsed.visibleText ?? null,
    }
  } catch {
    return {
      brand: null,
      productName: null,
      packSize: null,
      category: null,
      visibleText: null,
    }
  }
}

/** Deep Compare final step: side-by-side comparison against reference images (with retry + caching). */
export async function runDeepCompare(
  suspectImageBase64: string,
  mimeType: string,
  references: ReferenceImage[],
  category: ProductCategory | null,
  manufacturerSecurityFeatures?: SecurityFeature[],
  manufacturerFakeIndicators?: FakeIndicator[]
): Promise<ScanResult> {
  const prompt = buildDeepComparePrompt(
    category,
    references.length,
    manufacturerSecurityFeatures,
    manufacturerFakeIndicators
  )
  const cacheKey = vlmCacheKey(suspectImageBase64, prompt)
  const cached = getCachedVlm(cacheKey)
  if (cached) {
    console.log('[ai] deep compare cache hit (memory)')
    return { ...cached, referenceImages: references }
  }

  // Check the database cache (cross-instance sharing).
  const dbCached = await getDbCachedVlm(cacheKey)
  if (dbCached) {
    console.log('[ai] deep compare cache hit (database)')
    setCachedVlm(cacheKey, dbCached)
    return { ...dbCached, referenceImages: references }
  }

  const zai = await getZai()
  const suspectDataUrl = `data:${mimeType};base64,${suspectImageBase64}`

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: suspectDataUrl } },
    ...references.map((r) => ({
      type: 'image_url' as const,
      image_url: { url: r.imageUrl },
    })),
  ]

  const response = await withRetry(async () => {
    trackCost('vlm')
    return zai.chat.completions.createVision({
      messages: [{ role: 'user', content }],
      thinking: { type: 'disabled' },
    })
  }, 'deep-compare-vlm')

  const raw = response.choices[0]?.message?.content ?? ''
  const parsed = extractJson<ScanResult & { comparisonNotes?: string[] }>(raw)
  const result = normalizeResult(parsed)
  const finalResult = { ...result, referenceImages: references }
  setCachedVlm(cacheKey, result)
  return finalResult
}

// ---------------------------------------------------------------------------
// Manufacturer-registry-aware reference lookup
// ---------------------------------------------------------------------------

export interface ManufacturerReferences {
  found: boolean
  references: ReferenceImage[]
  securityFeatures: SecurityFeature[]
  fakeIndicators: FakeIndicator[]
  manufacturerName?: string
  manufacturerVerified?: boolean
}

/**
 * Check the manufacturer registry for ground-truth reference images.
 * Called by the Deep Compare flow BEFORE web search — manufacturer data
 * is preferred (it's official ground truth, not web-scraped guesses).
 */
export async function lookupManufacturerReferences(
  brand?: string | null,
  barcode?: string | null
): Promise<ManufacturerReferences> {
  try {
    const lookup = await lookupRegisteredProduct(brand, barcode)
    if (!lookup.found || lookup.referenceImages.length === 0) {
      return {
        found: false,
        references: [],
        securityFeatures: [],
        fakeIndicators: [],
      }
    }
    // Convert manufacturer reference images to the ReferenceImage format
    // with the highest credibility score (manufacturer = ground truth).
    const references: ReferenceImage[] = lookup.referenceImages.map((img) => ({
      imageUrl: img.imageUrl,
      sourceUrl: img.imageUrl,
      sourceType: 'manufacturer' as ReferenceSourceType,
      credibilityScore: 100, // manufacturer data is the highest-trust source
      caption: img.caption || `Manufacturer official reference (${img.angle || 'product'})`,
    }))
    return {
      found: true,
      references,
      securityFeatures: lookup.securityFeatures,
      fakeIndicators: lookup.knownFakeIndicators,
      manufacturerName: lookup.manufacturer?.companyName,
      manufacturerVerified: lookup.manufacturer?.verified,
    }
  } catch (err) {
    console.error('[ai] manufacturer lookup failed:', err)
    return { found: false, references: [], securityFeatures: [], fakeIndicators: [] }
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeResult(raw: Partial<ScanResult>): ScanResult {
  const flags = Array.isArray(raw.flags) ? raw.flags : []
  return {
    verdict: (raw.verdict as ScanResult['verdict']) ?? 'inconclusive',
    confidenceScore: clampScore(raw.confidenceScore),
    brandDetected: raw.brandDetected ?? undefined,
    productNameDetected: raw.productNameDetected ?? undefined,
    packSizeDetected: raw.packSizeDetected ?? undefined,
    flags: flags.map((f) => ({
      kind: (f.kind === 'red_flag' ? 'red_flag' : 'positive_indicator') as
        | 'red_flag'
        | 'positive_indicator',
      category: String(f.category ?? 'unknown'),
      description: String(f.description ?? ''),
      severity: (['low', 'medium', 'high'].includes(f.severity as string)
        ? f.severity
        : 'medium') as 'low' | 'medium' | 'high',
    })),
    reasoning: String(raw.reasoning ?? 'No reasoning provided.'),
  }
}

function clampScore(n: unknown): number {
  const num = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.min(95, Math.round(num)))
}
