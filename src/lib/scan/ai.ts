import ZAI from 'z-ai-web-dev-sdk'
import { execFile } from 'child_process'
import { promisify } from 'util'
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

/** Run `z-ai image-search` and return parsed JSON. */
export async function runImageSearch(
  query: string,
  count = 5,
  region = 'us'
): Promise<ImageSearchResult> {
  try {
    const { stdout } = await execFileAsync(
      'z-ai',
      ['image-search', '-q', query, '-c', String(count), '--gl', region, '--no-rank'],
      { maxBuffer: CLI_BUFFER, timeout: 120000 }
    )
    const json = extractFirstJson(stdout)
    return JSON.parse(json) as ImageSearchResult
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[image-search] failed:', message)
    return { success: false, error: message, results: [] }
  }
}

/** Run `z-ai function -n web_search` and return parsed JSON. */
export async function runWebSearch(query: string, num = 6): Promise<WebSearchResult> {
  try {
    const { stdout } = await execFileAsync(
      'z-ai',
      ['function', '-n', 'web_search', '-a', JSON.stringify({ query, num })],
      { maxBuffer: CLI_BUFFER, timeout: 60000 }
    )
    const json = extractFirstJson(stdout)
    // The web_search CLI returns a raw JSON array of {url, name, snippet, host_name, rank, date}.
    // Normalize to our WebSearchResult shape.
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
// VLM calls via SDK
// ---------------------------------------------------------------------------

/** Quick Scan: single-frame authenticity analysis. */
export async function runQuickScan(
  imageBase64: string,
  mimeType: string,
  category: ProductCategory | null
): Promise<ScanResult> {
  const zai = await getZai()
  const prompt = buildQuickScanPrompt(category)
  const dataUrl = `data:${mimeType};base64,${imageBase64}`

  const response = await zai.chat.completions.createVision({
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

  const content = response.choices[0]?.message?.content ?? ''
  const parsed = extractJson<ScanResult>(content)
  return normalizeResult(parsed)
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

  const response = await zai.chat.completions.createVision({
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

/** Deep Compare final step: side-by-side comparison against reference images. */
export async function runDeepCompare(
  suspectImageBase64: string,
  mimeType: string,
  references: ReferenceImage[],
  category: ProductCategory | null
): Promise<ScanResult> {
  const zai = await getZai()
  const prompt = buildDeepComparePrompt(category, references.length)
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

  const response = await zai.chat.completions.createVision({
    messages: [{ role: 'user', content }],
    thinking: { type: 'disabled' },
  })

  const raw = response.choices[0]?.message?.content ?? ''
  const parsed = extractJson<ScanResult & { comparisonNotes?: string[] }>(raw)
  const result = normalizeResult(parsed)
  return { ...result, referenceImages: references }
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
