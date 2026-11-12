import type {
  ProductCategory,
  ScanRecord,
  DeepCompareProgress,
} from './types'

/**
 * Client-side API helpers. Every call that needs device-scoping sends the
 * device fingerprint in a header so the server can attribute the scan.
 */

export interface QuickScanResponse {
  scan: ScanRecord
  persisted: boolean
  usingLocalStore: boolean
}

export async function quickScan(params: {
  image: string
  mimeType?: string
  category?: ProductCategory | null
  deviceFingerprint: string
  region?: string
}): Promise<QuickScanResponse> {
  const res = await fetch('/api/scan/quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Quick scan failed' }))
    throw new Error(err.error ?? `Quick scan failed (${res.status})`)
  }
  return res.json()
}

/**
 * Deep Compare: POSTs the photo, then reads the Server-Sent Events stream.
 * Calls onProgress for every stage event. Resolves with the final scan record.
 */
export async function deepCompare(params: {
  image: string
  mimeType?: string
  category?: ProductCategory | null
  deviceFingerprint: string
  region?: string
  onProgress: (p: DeepCompareProgress) => void
  signal?: AbortSignal
}): Promise<{ scan: ScanRecord; persisted: boolean; usingLocalStore: boolean }> {
  const res = await fetch('/api/scan/deep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: params.signal,
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: 'Deep compare failed' }))
    throw new Error(err.error ?? `Deep compare failed (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalScan: ScanRecord | null = null
  let persisted = false
  let usingLocalStore = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by \n\n
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const line = rawEvent.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const json = line.slice(6)
      try {
        const payload = JSON.parse(json) as DeepCompareProgress
        params.onProgress(payload)
        if (payload.stage === 'verdict' && payload.data) {
          const d = payload.data as { scan: ScanRecord; persisted: boolean; usingLocalStore: boolean }
          finalScan = d.scan
          persisted = d.persisted
          usingLocalStore = d.usingLocalStore
        } else if (payload.stage === 'error') {
          throw new Error(payload.message)
        }
      } catch (err) {
        // Re-throw real errors, swallow parse errors.
        if (err instanceof Error && err.message && !err.message.includes('JSON')) {
          throw err
        }
      }
    }
  }

  if (!finalScan) throw new Error('Deep compare completed without a verdict')
  return { scan: finalScan, persisted, usingLocalStore }
}

export async function listHistory(deviceFingerprint: string, region?: string): Promise<{
  scans: ScanRecord[]
  usingLocalStore: boolean
}> {
  const url = `/api/scan/history?limit=50${region ? `&region=${encodeURIComponent(region)}` : ''}`
  const res = await fetch(url, {
    headers: { 'x-device-fingerprint': deviceFingerprint },
  })
  if (!res.ok) return { scans: [], usingLocalStore: false }
  return res.json()
}

export async function deleteScan(id: string): Promise<boolean> {
  const res = await fetch(`/api/scan/${id}`, { method: 'DELETE' })
  return res.ok
}

export async function submitReport(params: {
  brand: string
  productName?: string
  region?: string
  details?: string
  deviceFingerprint: string
}): Promise<{ ok: boolean; usingLocalStore: boolean }> {
  const res = await fetch('/api/community/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to submit report')
  return res.json()
}

export interface ProductLookupResponse {
  product: import('./barcode').BarcodeLookupResult
  regulator: import('./regulators').RegulatorResult | null
}

export async function lookupProduct(barcode: string, country?: string): Promise<ProductLookupResponse> {
  const url = `/api/product/lookup?barcode=${encodeURIComponent(barcode)}${country ? `&country=${encodeURIComponent(country)}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Product lookup failed')
  return res.json()
}
