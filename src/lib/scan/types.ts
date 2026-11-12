// Shared types for the AuthVerify counterfeit detection co-pilot.

export type ScanMode = 'quick' | 'deep'

export type Verdict = 'likely_authentic' | 'high_risk_counterfeit' | 'inconclusive'

export type FlagKind = 'red_flag' | 'positive_indicator'

export type FlagSeverity = 'low' | 'medium' | 'high'

export type ProductCategory =
  | 'medicine_otc'
  | 'medicine_antimalarial'
  | 'medicine_prescription'
  | 'medicine_supplement'
  | 'cosmetic'
  | 'beverage'
  | 'packaged_food'
  | 'electronics_accessory'
  | 'electronics_device'
  | 'household_good'
  | 'apparel'
  | 'auto_consumable'
  | 'currency'
  | 'other_branded'

export interface ScanFlag {
  kind: FlagKind
  category: string
  description: string
  severity: FlagSeverity
}

export type ReferenceSourceType =
  | 'manufacturer'
  | 'retailer'
  | 'regulatory'
  | 'marketplace'
  | 'unknown'

export interface ReferenceImage {
  imageUrl: string
  sourceUrl: string
  sourceType: ReferenceSourceType
  credibilityScore: number
  caption?: string
}

export interface ScanResult {
  verdict: Verdict
  confidenceScore: number
  brandDetected?: string
  productNameDetected?: string
  packSizeDetected?: string
  flags: ScanFlag[]
  reasoning: string
  referenceImages?: ReferenceImage[]
}

export interface ScanRecord extends ScanResult {
  id: string
  mode: ScanMode
  category: ProductCategory | null
  suspectImageUrl?: string
  region?: string
  createdAt: string
}

export interface DeepCompareProgress {
  stage:
    | 'extracting'
    | 'cache_check'
    | 'searching'
    | 'references_found'
    | 'caching'
    | 'comparing'
    | 'verdict'
    | 'error'
  message: string
  data?: unknown
}

export interface CommunityReport {
  id: string
  brand: string
  productName?: string
  region?: string
  details?: string
  status: 'pending' | 'verified' | 'dismissed'
  createdAt: string
}
