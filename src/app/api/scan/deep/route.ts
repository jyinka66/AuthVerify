import { NextRequest } from 'next/server'
import {
  runImageSearch,
  runWebSearch,
  toReferenceImages,
  extractProductInfo,
  runDeepCompare,
  type ExtractedInfo,
} from '@/lib/scan/ai'
import { ensureDevice, saveScan, getCachedReferences, cacheReferences } from '@/lib/scan/store-server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type {
  ProductCategory,
  ReferenceImage,
  ScanRecord,
  ScanResult,
  DeepCompareProgress,
} from '@/lib/scan/types'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 300 // Deep compare can take a while (image-search is slow).

interface DeepCompareBody {
  image: string
  mimeType?: string
  category?: ProductCategory | null
  deviceFingerprint?: string
  region?: string
}

function parseImage(input: string, fallbackMime?: string): { base64: string; mimeType: string } {
  const dataUrlMatch = input.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (dataUrlMatch) return { mimeType: dataUrlMatch[1], base64: dataUrlMatch[2] }
  if (!fallbackMime) throw new Error('Missing mimeType for raw base64 image')
  return { mimeType: fallbackMime, base64: input }
}

function buildSearchQuery(info: ExtractedInfo, category: ProductCategory | null): string {
  const parts: string[] = []
  if (info.brand) parts.push(info.brand)
  if (info.productName) parts.push(info.productName)
  if (info.packSize) parts.push(info.packSize)
  if (parts.length === 0) {
    parts.push('genuine original branded product packaging')
  }
  // Bias the query toward authentic reference imagery.
  const categoryHint = category === 'currency'
    ? 'official security features'
    : category?.startsWith('medicine')
      ? 'NAFDAC genuine original packaging'
      : 'original genuine official packaging'
  return `${parts.join(' ')} ${categoryHint}`
}

function sseData(payload: DeepCompareProgress): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export async function POST(req: NextRequest) {
  let body: DeepCompareBody
  try {
    body = (await req.json()) as DeepCompareBody
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (!body.image) {
    return new Response('Missing image', { status: 400 })
  }

  let parsed
  try {
    parsed = parseImage(body.image, body.mimeType)
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : 'Invalid image',
      { status: 400 }
    )
  }

  const supabaseOn = isSupabaseConfigured()
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (p: DeepCompareProgress) =>
        controller.enqueue(encoder.encode(sseData(p)))

      try {
        // Step 1: extract brand / product info from the suspect photo.
        emit({ stage: 'extracting', message: 'Reading brand and product details from your photo…' })
        const info = await extractProductInfo(parsed.base64, parsed.mimeType)
        emit({
          stage: 'extracting',
          message: `Detected: ${[info.brand, info.productName, info.packSize].filter(Boolean).join(' — ') || 'no clear text found'}`,
          data: info,
        })

        const effectiveCategory = body.category ?? info.category ?? null
        const searchQuery = buildSearchQuery(info, effectiveCategory)
        const brandKey = (info.brand ?? 'unknown').trim()

        // Step 2: check reference cache.
        emit({ stage: 'cache_check', message: 'Checking cached genuine references…' })
        let references: ReferenceImage[] | null = null
        if (supabaseOn) {
          references = await getCachedReferences(brandKey, info.productName ?? undefined)
        }
        if (references && references.length > 0) {
          emit({
            stage: 'references_found',
            message: `Found ${references.length} cached genuine reference image(s).`,
            data: references,
          })
        } else {
          // Step 3: web search for context (titles, snippets, official sites).
          emit({ stage: 'searching', message: `Searching the web for genuine references: "${searchQuery}"…` })
          const web = await runWebSearch(searchQuery, 6)
          const webHits = web.results ?? web.data ?? []
          emit({
            stage: 'searching',
            message: `Web search returned ${webHits.length} result(s).`,
            data: webHits.slice(0, 3),
          })

          // Step 4: image search for genuine reference images.
          emit({ stage: 'searching', message: 'Fetching genuine reference images from the web…' })
          const img = await runImageSearch(searchQuery, 6, 'us')
          references = toReferenceImages(img)

          if (references.length === 0) {
            // Fallback: try a simpler query without the category hint.
            const simpler = [info.brand, info.productName].filter(Boolean).join(' ')
            if (simpler) {
              const retry = await runImageSearch(`${simpler} original packaging`, 6, 'us')
              references = toReferenceImages(retry)
            }
          }

          if (references.length === 0) {
            emit({
              stage: 'comparing',
              message: 'No genuine reference images found online. Falling back to single-image authenticity analysis.',
            })
          } else {
            emit({
              stage: 'references_found',
              message: `Found ${references.length} genuine reference image(s) from the web.`,
              data: references,
            })

            // Step 5: cache the references (server-only write via service role).
            if (supabaseOn) {
              emit({ stage: 'caching', message: 'Caching references for faster future scans…' })
              await cacheReferences(brandKey, info.productName, references)
            }
          }
        }

        // Step 6: VLM side-by-side comparison (or single-image fallback).
        emit({ stage: 'comparing', message: 'Comparing your photo against the genuine reference(s)…' })
        let result: ScanResult
        if (references && references.length > 0) {
          result = await runDeepCompare(parsed.base64, parsed.mimeType, references, effectiveCategory)
        } else {
          // No references found — fall back to a single-image quick analysis.
          const { runQuickScan } = await import('@/lib/scan/ai')
          result = await runQuickScan(parsed.base64, parsed.mimeType, effectiveCategory)
          // Mark that this was a degraded result.
          result.reasoning =
            `No genuine reference images were found online for this product, so a side-by-side comparison could not be performed. ${result.reasoning}`
        }

        // Step 7: persist + emit verdict.
        let scanId: string | null = null
        if (supabaseOn && body.deviceFingerprint) {
          const deviceId = await ensureDevice(body.deviceFingerprint, body.region)
          scanId = await saveScan({
            deviceId,
            mode: 'deep',
            category: effectiveCategory,
            result,
            region: body.region,
          })
        }

        const fallbackId = scanId ?? randomUUID()
        const record: ScanRecord = {
          id: fallbackId,
          mode: 'deep',
          category: effectiveCategory,
          ...result,
          region: body.region,
          createdAt: new Date().toISOString(),
        }

        emit({
          stage: 'verdict',
          message: 'Verification complete.',
          data: { scan: record, persisted: Boolean(scanId), usingLocalStore: !supabaseOn },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Deep compare failed'
        console.error('[/api/scan/deep] failed:', err)
        emit({ stage: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
