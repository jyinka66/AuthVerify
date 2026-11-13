import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getManufacturerByUser, addProductReferenceImage } from '@/lib/scan/manufacturer-store'
import { validateAndSanitizeImage, ImageValidationError } from '@/lib/scan/image-validation'

export const runtime = 'nodejs'
export const maxDuration = 30

interface ImageUploadBody {
  image: string
  angle?: string
  caption?: string
}

/**
 * POST /api/manufacturer/product/[id]/images
 *
 * Uploads a reference image for a manufacturer's product. The image is
 * validated + sanitized (EXIF stripped, resized), stored in Supabase
 * Storage (suspect-photos bucket), and a row is created in
 * product_reference_images linking it to the product.
 *
 * Only the owning manufacturer can upload images for their products.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured.' }, { status: 503 })
  }

  const supabase = await createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const manufacturer = await getManufacturerByUser(user.id)
  if (!manufacturer) {
    return NextResponse.json({ error: 'Manufacturer profile not found.' }, { status: 403 })
  }

  // Verify the product belongs to this manufacturer.
  const serviceRole = createServiceRoleClient()
  if (!serviceRole) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const { data: product, error: productError } = await serviceRole
    .from('manufacturer_products')
    .select('manufacturer_id')
    .eq('id', productId)
    .maybeSingle()

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
  }
  if (product.manufacturer_id !== manufacturer.id) {
    return NextResponse.json({ error: 'You do not own this product.' }, { status: 403 })
  }

  let body: ImageUploadBody
  try {
    body = (await req.json()) as ImageUploadBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.image) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 })
  }

  // Validate + sanitize the image.
  let validated
  try {
    validated = await validateAndSanitizeImage(body.image)
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Image validation failed' }, { status: 400 })
  }

  // Upload to Supabase Storage.
  const filePath = `${manufacturer.id}/${productId}/${Date.now()}.jpg`
  const { error: uploadError } = await serviceRole.storage
    .from('reference-images')
    .upload(filePath, Buffer.from(validated.base64, 'base64'), {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    console.error('[manufacturer/images] upload failed:', uploadError.message)
    return NextResponse.json({ error: 'Failed to upload image.' }, { status: 500 })
  }

  // Get the public URL.
  const { data: urlData } = serviceRole.storage
    .from('reference-images')
    .getPublicUrl(filePath)

  const imageUrl = urlData.publicUrl

  // Create the reference image record.
  const imageId = await addProductReferenceImage({
    productId,
    imageUrl,
    angle: body.angle,
    caption: body.caption,
  })

  if (!imageId) {
    return NextResponse.json({ error: 'Failed to create image record.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, imageId, imageUrl })
}

/**
 * GET /api/manufacturer/product/[id]/images
 * Lists all reference images for a product.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ images: [] })
  }

  const serviceRole = createServiceRoleClient()
  if (!serviceRole) return NextResponse.json({ images: [] })

  const { data, error } = await serviceRole
    .from('product_reference_images')
    .select('id, product_id, image_url, angle, caption, sort_order, created_at')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ images: [] })

  return NextResponse.json({ images: data ?? [] })
}
