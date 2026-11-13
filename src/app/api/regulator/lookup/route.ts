import { NextRequest, NextResponse } from 'next/server'
import { lookupRegulator } from '@/lib/scan/regulators'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/regulator/lookup?brand=...&productName=...&country=NG
 * Searches the relevant African drug regulator's public registry
 * (NAFDAC for Nigeria, plus generic fallbacks for Ghana, Kenya, etc.)
 */
export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get('brand')
  const productName = req.nextUrl.searchParams.get('productName') ?? undefined
  const country = req.nextUrl.searchParams.get('country') ?? undefined

  if (!brand) {
    return NextResponse.json({ error: 'Missing brand param' }, { status: 400 })
  }

  const result = await lookupRegulator(brand, productName, country)
  return NextResponse.json({ result })
}
