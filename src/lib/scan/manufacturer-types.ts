// Manufacturer registry types.

export interface Manufacturer {
  id: string
  userId?: string
  companyName: string
  country: string
  contactEmail: string
  phone?: string
  regulatoryLicenseNumber?: string
  website?: string
  verified: boolean
  createdAt: string
}

export interface SecurityFeature {
  feature: string
  location: string
  description: string
}

export interface FakeIndicator {
  indicator: string
  description: string
}

export interface ManufacturerProduct {
  id: string
  manufacturerId: string
  productName: string
  brand: string
  category: string
  barcode?: string
  packSize?: string
  description?: string
  securityFeatures: SecurityFeature[]
  knownFakeIndicators: FakeIndicator[]
  manufacturer?: Pick<Manufacturer, 'companyName' | 'country' | 'verified'>
  referenceImages?: ProductReferenceImage[]
  createdAt: string
}

export interface ProductReferenceImage {
  id: string
  productId: string
  imageUrl: string
  angle?: string
  caption?: string
  sortOrder: number
}

export interface RegisteredProductLookup {
  found: boolean
  product?: ManufacturerProduct
  manufacturer?: Pick<Manufacturer, 'companyName' | 'country' | 'verified'>
  referenceImages: ProductReferenceImage[]
  securityFeatures: SecurityFeature[]
  knownFakeIndicators: FakeIndicator[]
}
