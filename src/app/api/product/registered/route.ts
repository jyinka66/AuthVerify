import { NextRequest, NextResponse } from 'next/server'
import { lookupRegisteredProduct } from '@/lib/scan/manufacturer-store'

export const runtime = 'nodejs'
export const maxDuration = 10

/**
 * GET /api/product/registered?brand=...&barcode=...
 *
 * Public lookup: checks the manufacturer registry for a product matching
 * the brand or barcode. Returns manufacturer-provided reference images
 * and security features when found — these are ground truth, preferred
 * over web-searched references in the verification flow.
 */
export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get('brand')
  const barcode = req.nextUrl.searchParams.get('barcode')

  if (!brand && !barcode) {
    return NextResponse.json({ error: 'Provide brand or barcode param' }, { status: 400 })
  }

  const result = await lookupRegisteredProduct(brand, barcode)
  return NextResponse.json(result)
}
