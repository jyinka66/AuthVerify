import { NextRequest, NextResponse } from 'next/server'
import { lookupBarcode } from '@/lib/scan/barcode'
import { lookupRegulator } from '@/lib/scan/regulators'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/product/lookup?barcode=...&country=NG
 * Looks up a product by barcode (OpenFoodFacts + web search) and, for
 * medicines, also runs a regulator check. Returns combined info that the
 * client can use to pre-fill a verification scan.
 */
export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')
  const country = req.nextUrl.searchParams.get('country') ?? undefined

  if (!barcode) {
    return NextResponse.json({ error: 'Missing barcode param' }, { status: 400 })
  }

  const product = await lookupBarcode(barcode)

  // If the product looks like a medicine, also run a regulator lookup.
  let regulator = null
  if (product.found && product.brand) {
    const category = (product.category ?? '').toLowerCase()
    if (category.includes('pharma') || category.includes('medic') || category.includes('health')) {
      regulator = await lookupRegulator(product.brand, product.productName, country)
    }
  }

  return NextResponse.json({ product, regulator })
}
