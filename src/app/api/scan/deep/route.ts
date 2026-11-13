import { NextRequest } from 'next/server'
import {
  runImageSearch,
  runWebSearch,
  toReferenceImages,
  extractProductInfo,
  runDeepCompare,
  lookupManufacturerReferences,
  type ExtractedInfo,
  type ManufacturerReferences,
} from '@/lib/scan/ai'
import { ensureDevice, saveScan, getCachedReferences, cacheReferences } from '@/lib/scan/store-server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, rateLimitHeaders, LIMITS } from '@/lib/scan/rate-limit'
import { validateAndSanitizeImage, ImageValidationError } from '@/lib/scan/image-validation'
import type {
  ProductCategory,
  ReferenceImage,
  ScanRecord,
  ScanResult,
  DeepCompareProgress,
} from '@/lib/scan/types'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 300

interface DeepCompareBody {
  image: string
  mimeType?: string
  category?: ProductCategory | null
  deviceFingerprint?: string
  region?: string
}

function buildSearchQuery(info: ExtractedInfo, category: ProductCategory | null): string {
  const parts: string[] = []
  if (info.brand) parts.push(info.brand)
  if (info.productName) parts.push(info.productName)
  if (info.packSize) parts.push(info.packSize)
  if (parts.length === 0) {
    parts.push('genuine original branded product packaging')
  }
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
  // Rate limit check — Deep Compare is expensive, so limits are tighter.
  const ip = getClientIp(req)
  const deviceFp = req.headers.get('x-device-fingerprint') ?? 'anon'
  const limit = checkRateLimit(deviceFp, ip, LIMITS.deep)
  if (!limit.allowed) {
    const message = limit.budgetExhausted
      ? 'Daily verification budget exhausted. Please try again tomorrow.'
      : 'Rate limit exceeded. Deep Compare is limited to 5 per hour.'
    return new Response(
      sseData({ stage: 'error', message }),
      { status: 429, headers: { 'Content-Type': 'text/event-stream', ...rateLimitHeaders(limit) } }
    )
  }

  let body: DeepCompareBody
  try {
    body = (await req.json()) as DeepCompareBody
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (!body.image) {
    return new Response('Missing image', { status: 400 })
  }

  // Validate + sanitize the image.
  let validated
  try {
    validated = await validateAndSanitizeImage(body.image, body.mimeType)
  } catch (err) {
    const message = err instanceof ImageValidationError ? err.message : 'Image validation failed'
    return new Response(message, { status: 400 })
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
        const info = await extractProductInfo(validated.base64, validated.mimeType)
        emit({
          stage: 'extracting',
          message: `Detected: ${[info.brand, info.productName, info.packSize].filter(Boolean).join(' — ') || 'no clear text found'}`,
          data: info,
        })

        const effectiveCategory = body.category ?? info.category ?? null
        const searchQuery = buildSearchQuery(info, effectiveCategory)
        const brandKey = (info.brand ?? 'unknown').trim()

        // Step 2: check manufacturer registry FIRST (ground truth, preferred over web search).
        emit({ stage: 'cache_check', message: 'Checking the manufacturer registry for official reference images…' })
        const manufacturerRefs = await lookupManufacturerReferences(info.brand, undefined)

        let references: ReferenceImage[] | null = null
        let manufacturerSecurityFeatures: ManufacturerReferences['securityFeatures'] = []
        let manufacturerFakeIndicators: ManufacturerReferences['fakeIndicators'] = []
        let usingManufacturerData = false

        if (manufacturerRefs.found && manufacturerRefs.references.length > 0) {
          references = manufacturerRefs.references
          manufacturerSecurityFeatures = manufacturerRefs.securityFeatures
          manufacturerFakeIndicators = manufacturerRefs.fakeIndicators
          usingManufacturerData = true
          emit({
            stage: 'references_found',
            message: `Found ${references.length} official reference image(s) from ${manufacturerRefs.manufacturerName || 'the manufacturer'} (ground truth).${manufacturerRefs.manufacturerVerified ? ' Manufacturer verified.' : ''}`,
            data: references,
          })
        } else {
          // Step 3: check the web-reference cache (for previously web-searched products).
          emit({ stage: 'cache_check', message: 'Checking cached web references…' })
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
            // Step 4: web search for context.
            emit({ stage: 'searching', message: `Searching the web for genuine references: "${searchQuery}"…` })
            const web = await runWebSearch(searchQuery, 6)
            const webHits = web.results ?? web.data ?? []
            emit({
              stage: 'searching',
              message: `Web search returned ${webHits.length} result(s).`,
              data: webHits.slice(0, 3),
            })

            // Step 5: image search for genuine reference images.
            emit({ stage: 'searching', message: 'Fetching genuine reference images from the web…' })
            const img = await runImageSearch(searchQuery, 6, 'us')
            references = toReferenceImages(img)

            if (references.length === 0) {
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

              if (supabaseOn) {
                emit({ stage: 'caching', message: 'Caching references for faster future scans…' })
                await cacheReferences(brandKey, info.productName, references)
              }
            }
          }
        }

        // Step 6: VLM side-by-side comparison.
        const sourceLabel = usingManufacturerData ? 'manufacturer official reference(s)' : 'genuine reference(s)'
        emit({ stage: 'comparing', message: `Comparing your photo against the ${sourceLabel}…` })
        let result: ScanResult
        if (references && references.length > 0) {
          result = await runDeepCompare(
            validated.base64,
            validated.mimeType,
            references,
            effectiveCategory,
            manufacturerSecurityFeatures,
            manufacturerFakeIndicators
          )
          if (usingManufacturerData) {
            result.reasoning = `Verified against official manufacturer reference images${manufacturerRefs.manufacturerName ? ` from ${manufacturerRefs.manufacturerName}` : ''}. ${result.reasoning}`
          }
        } else {
          const { runQuickScan } = await import('@/lib/scan/ai')
          result = await runQuickScan(validated.base64, validated.mimeType, effectiveCategory)
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
      ...rateLimitHeaders(limit),
    },
  })
}
