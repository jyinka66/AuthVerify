import { NextRequest, NextResponse } from 'next/server'
import { getCachedReferences } from '@/lib/scan/store-server'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get('brand')
  const productName = req.nextUrl.searchParams.get('product') ?? undefined

  if (!brand) {
    return NextResponse.json({ error: 'Missing brand param' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ references: [], cached: false })
  }

  const references = await getCachedReferences(brand, productName)
  return NextResponse.json({ references: references ?? [], cached: Boolean(references?.length) })
}
