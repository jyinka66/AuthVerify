import { runWebSearch } from './ai'

export interface BarcodeLookupResult {
  found: boolean
  barcode: string
  productName?: string
  brand?: string
  category?: string
  imageUrl?: string
  source: 'openfoodfacts' | 'web_search' | 'none'
  notes?: string
}

/**
 * Look up a product by its barcode (EAN/UPC/GTIN).
 * Tries OpenFoodFacts first (covers food, beverages, some cosmetics and
 * consumer goods), then falls back to a generic web search by barcode.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const cleaned = barcode.trim()
  if (!cleaned) return { found: false, barcode, source: 'none' }

  // 1. OpenFoodFacts (free, no API key, covers food/beverage/cosmetics).
  const off = await lookupOpenFoodFacts(cleaned)
  if (off.found) return off

  // 2. Generic web search by barcode.
  const web = await lookupViaWebSearch(cleaned)
  return web
}

async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeLookupResult> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories,image_url,code`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AuthVerify/1.0 (counterfeit detection co-pilot)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { found: false, barcode, source: 'none' }
    const data = await res.json()
    if (data.status !== 1 || !data.product) {
      return { found: false, barcode, source: 'none' }
    }
    const p = data.product
    return {
      found: true,
      barcode,
      productName: p.product_name ?? undefined,
      brand: p.brands ?? undefined,
      category: p.categories ?? undefined,
      imageUrl: p.image_url ?? undefined,
      source: 'openfoodfacts',
      notes: 'Looked up via OpenFoodFacts (open product database).',
    }
  } catch {
    return { found: false, barcode, source: 'none' }
  }
}

async function lookupViaWebSearch(barcode: string): Promise<BarcodeLookupResult> {
  const res = await runWebSearch(`barcode "${barcode}" product brand`, 4)
  const hits = res.results ?? res.data ?? []
  if (hits.length === 0) {
    return { found: false, barcode, source: 'none', notes: 'No product found for this barcode online.' }
  }

  // Take the top hit as the best guess.
  const top = hits[0]
  const snippet = top.snippet || top.title || ''
  return {
    found: true,
    barcode,
    productName: top.title,
    brand: extractBrandFromText(snippet),
    source: 'web_search',
    notes: `Found via web search${top.source ? ` (${top.source})` : ''}. Verify the product name matches the packaging.`,
  }
}

function extractBrandFromText(text: string): string | undefined {
  // Heuristic: look for "by <Brand>" or "Brand: <Brand>" patterns.
  const byMatch = text.match(/\bby\s+([A-Z][a-zA-Z0-9&\- ]{2,30})/)
  if (byMatch) return byMatch[1].trim()
  const brandMatch = text.match(/\bBrand:\s*([A-Za-z0-9&\- ]{2,30})/i)
  if (brandMatch) return brandMatch[1].trim()
  return undefined
}
