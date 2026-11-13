import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase/server'
import {
  getManufacturerByUser,
  createManufacturerProduct,
  addProductReferenceImage,
} from '@/lib/scan/manufacturer-store'
import type { SecurityFeature, FakeIndicator } from '@/lib/scan/manufacturer-types'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ProductBody {
  productName: string
  brand: string
  category: string
  barcode?: string
  packSize?: string
  description?: string
  securityFeatures?: SecurityFeature[]
  knownFakeIndicators?: FakeIndicator[]
  referenceImages?: Array<{
    imageUrl: string
    angle?: string
    caption?: string
  }>
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  }

  const supabase = await createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const manufacturer = await getManufacturerByUser(user.id)
  if (!manufacturer) {
    return NextResponse.json({ error: 'Register your manufacturer profile first.' }, { status: 403 })
  }

  let body: ProductBody
  try {
    body = (await req.json()) as ProductBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.productName?.trim() || !body.brand?.trim() || !body.category?.trim()) {
    return NextResponse.json(
      { error: 'Product name, brand, and category are required.' },
      { status: 400 }
    )
  }

  const productId = await createManufacturerProduct({
    manufacturerId: manufacturer.id,
    productName: body.productName.trim(),
    brand: body.brand.trim(),
    category: body.category.trim(),
    barcode: body.barcode?.trim() || undefined,
    packSize: body.packSize?.trim() || undefined,
    description: body.description?.trim() || undefined,
    securityFeatures: body.securityFeatures,
    knownFakeIndicators: body.knownFakeIndicators,
  })

  if (!productId) {
    return NextResponse.json({ error: 'Failed to create product.' }, { status: 500 })
  }

  // Attach reference images if provided.
  if (body.referenceImages && body.referenceImages.length > 0) {
    for (let i = 0; i < body.referenceImages.length; i++) {
      const img = body.referenceImages[i]
      if (img.imageUrl) {
        await addProductReferenceImage({
          productId,
          imageUrl: img.imageUrl,
          angle: img.angle,
          caption: img.caption,
        })
      }
    }
  }

  return NextResponse.json({ ok: true, productId })
}
