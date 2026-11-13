import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { listManufacturerProducts, getManufacturerByUser } from '@/lib/scan/manufacturer-store'

export const runtime = 'nodejs'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ products: [], configured: false })
  }

  const supabase = await createServerClient()
  if (!supabase) return NextResponse.json({ products: [], configured: false })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ products: [], configured: true })

  const manufacturer = await getManufacturerByUser(user.id)
  if (!manufacturer) return NextResponse.json({ products: [], configured: true, manufacturer: null })

  const products = await listManufacturerProducts(manufacturer.id)
  return NextResponse.json({ products, configured: true, manufacturer })
}
