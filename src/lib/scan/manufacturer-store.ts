import { createServiceRoleClient } from '@/lib/supabase/server'
import type {
  Manufacturer,
  ManufacturerProduct,
  ProductReferenceImage,
  RegisteredProductLookup,
  SecurityFeature,
  FakeIndicator,
} from './manufacturer-types'

/**
 * Manufacturer registry data access. All functions gracefully no-op
 * (return null/empty) when Supabase is not configured.
 *
 * The key function is `lookupRegisteredProduct` — called by the verification
 * flow to check if a product has manufacturer-provided ground truth.
 */

const TABLE_MANUFACTURERS = 'manufacturers'
const TABLE_PRODUCTS = 'manufacturer_products'
const TABLE_REF_IMAGES = 'product_reference_images'

// ---------------------------------------------------------------------------
// Public lookup (used by the verification flow)
// ---------------------------------------------------------------------------

export async function lookupRegisteredProduct(
  brand?: string | null,
  barcode?: string | null
): Promise<RegisteredProductLookup> {
  const supabase = createServiceRoleClient()
  if (!supabase || (!brand && !barcode)) {
    return { found: false, referenceImages: [], securityFeatures: [], knownFakeIndicators: [] }
  }

  // Try barcode first (most precise), then brand.
  let query = supabase
    .from(TABLE_PRODUCTS)
    .select(`
      id, manufacturer_id, product_name, brand, category, barcode, pack_size, description,
      security_features_json, known_fake_indicators_json, created_at,
      manufacturer:manufacturers!inner(id, company_name, country, verified)
    `)

  if (barcode) {
    query = query.eq('barcode', barcode)
  } else if (brand) {
    query = query.ilike('brand', brand)
  }

  const { data, error } = await query.limit(1).maybeSingle()

  if (error || !data) {
    // Fall back to brand search if barcode didn't match.
    if (barcode && brand) {
      return lookupRegisteredProduct(brand, null)
    }
    return { found: false, referenceImages: [], securityFeatures: [], knownFakeIndicators: [] }
  }

  // Fetch reference images for this product.
  const { data: images } = await supabase
    .from(TABLE_REF_IMAGES)
    .select('id, product_id, image_url, angle, caption, sort_order')
    .eq('product_id', data.id)
    .order('sort_order', { ascending: true })
    .limit(8)

  const securityFeatures = parseSecurityFeatures(data.security_features_json)
  const fakeIndicators = parseFakeIndicators(data.known_fake_indicators_json)
  const referenceImages = (images ?? []).map(mapRefImageRow)
  const manufacturer = Array.isArray(data.manufacturer) ? data.manufacturer[0] : data.manufacturer

  return {
    found: true,
    manufacturer: manufacturer
      ? {
          companyName: manufacturer.company_name,
          country: manufacturer.country,
          verified: manufacturer.verified,
        }
      : undefined,
    referenceImages,
    securityFeatures,
    knownFakeIndicators: fakeIndicators,
  }
}

// ---------------------------------------------------------------------------
// Manufacturer CRUD (requires auth — handled by the API routes)
// ---------------------------------------------------------------------------

export async function createManufacturerProfile(params: {
  userId: string
  companyName: string
  country: string
  contactEmail: string
  phone?: string
  regulatoryLicenseNumber?: string
  website?: string
}): Promise<string | null> {
  const supabase = createServiceRoleClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from(TABLE_MANUFACTURERS)
    .insert({
      user_id: params.userId,
      company_name: params.companyName,
      country: params.country,
      contact_email: params.contactEmail,
      phone: params.phone ?? null,
      regulatory_license_number: params.regulatoryLicenseNumber ?? null,
      website: params.website ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[manufacturer] createManufacturerProfile failed:', error?.message)
    return null
  }
  return data.id
}

export async function getManufacturerByUser(userId: string): Promise<Manufacturer | null> {
  const supabase = createServiceRoleClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from(TABLE_MANUFACTURERS)
    .select('id, user_id, company_name, country, contact_email, phone, regulatory_license_number, website, verified, created_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return mapManufacturerRow(data)
}

export async function listManufacturerProducts(manufacturerId: string): Promise<ManufacturerProduct[]> {
  const supabase = createServiceRoleClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from(TABLE_PRODUCTS)
    .select('id, manufacturer_id, product_name, brand, category, barcode, pack_size, description, security_features_json, known_fake_indicators_json, created_at')
    .eq('manufacturer_id', manufacturerId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    manufacturerId: row.manufacturer_id,
    productName: row.product_name,
    brand: row.brand,
    category: row.category,
    barcode: row.barcode ?? undefined,
    packSize: row.pack_size ?? undefined,
    description: row.description ?? undefined,
    securityFeatures: parseSecurityFeatures(row.security_features_json),
    knownFakeIndicators: parseFakeIndicators(row.known_fake_indicators_json),
    createdAt: row.created_at,
  }))
}

export async function createManufacturerProduct(params: {
  manufacturerId: string
  productName: string
  brand: string
  category: string
  barcode?: string
  packSize?: string
  description?: string
  securityFeatures?: SecurityFeature[]
  knownFakeIndicators?: FakeIndicator[]
}): Promise<string | null> {
  const supabase = createServiceRoleClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from(TABLE_PRODUCTS)
    .insert({
      manufacturer_id: params.manufacturerId,
      product_name: params.productName,
      brand: params.brand,
      category: params.category,
      barcode: params.barcode ?? null,
      pack_size: params.packSize ?? null,
      description: params.description ?? null,
      security_features_json: params.securityFeatures ?? [],
      known_fake_indicators_json: params.knownFakeIndicators ?? [],
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[manufacturer] createManufacturerProduct failed:', error?.message)
    return null
  }
  return data.id
}

export async function addProductReferenceImage(params: {
  productId: string
  imageUrl: string
  angle?: string
  caption?: string
}): Promise<string | null> {
  const supabase = createServiceRoleClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from(TABLE_REF_IMAGES)
    .insert({
      product_id: params.productId,
      image_url: params.imageUrl,
      angle: params.angle ?? 'other',
      caption: params.caption ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return null
  return data.id
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSecurityFeatures(json: unknown): SecurityFeature[] {
  if (!Array.isArray(json)) return []
  return json as SecurityFeature[]
}

function parseFakeIndicators(json: unknown): FakeIndicator[] {
  if (!Array.isArray(json)) return []
  return json as FakeIndicator[]
}

interface ManufacturerRow {
  id: string
  user_id: string | null
  company_name: string
  country: string
  contact_email: string
  phone: string | null
  regulatory_license_number: string | null
  website: string | null
  verified: boolean
  created_at: string
}

function mapManufacturerRow(row: ManufacturerRow): Manufacturer {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    companyName: row.company_name,
    country: row.country,
    contactEmail: row.contact_email,
    phone: row.phone ?? undefined,
    regulatoryLicenseNumber: row.regulatory_license_number ?? undefined,
    website: row.website ?? undefined,
    verified: row.verified,
    createdAt: row.created_at,
  }
}

interface RefImageRow {
  id: string
  product_id: string
  image_url: string
  angle: string | null
  caption: string | null
  sort_order: number
}

function mapRefImageRow(row: RefImageRow): ProductReferenceImage {
  return {
    id: row.id,
    productId: row.product_id,
    imageUrl: row.image_url,
    angle: row.angle ?? undefined,
    caption: row.caption ?? undefined,
    sortOrder: row.sort_order,
  }
}
