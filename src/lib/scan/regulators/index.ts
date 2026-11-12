import { runWebSearch } from '../ai'

export interface RegulatorResult {
  regulator: string
  country: string
  status: 'registered' | 'not_found' | 'unknown'
  registrationNumber?: string
  productUrl?: string
  notes?: string
}

export interface Regulator {
  id: string
  name: string
  country: string
  /** Search for a product in this regulator's public registry. */
  search(brand: string, productName?: string): Promise<RegulatorResult>
}

// ---------------------------------------------------------------------------
// NAFDAC (Nigeria) — searches the web for NAFDAC registration evidence.
// NAFDAC registration numbers typically look like "NAFDAC Reg. No: XX-XXXX"
// or "A11-0123" or "B1-2345" prefixed variants.
// ---------------------------------------------------------------------------

const NAFDAC_REG_PATTERN = /NAFDAC\s*(?:Reg(?:istration)?\.?\s*(?:No|Number)\.?\s*:?\s*)?([A-Z]?\d{1,3}-?\d{3,5})/i

export const nafdacRegulator: Regulator = {
  id: 'nafdac',
  name: 'NAFDAC',
  country: 'Nigeria',
  async search(brand, productName) {
    const query = `NAFDAC "${brand}"${productName ? ` "${productName}"` : ''} registration number registered`
    const res = await runWebSearch(query, 5)
    const hits = res.results ?? res.data ?? []

    if (hits.length === 0) {
      return {
        regulator: 'NAFDAC',
        country: 'Nigeria',
        status: 'not_found',
        notes: 'No NAFDAC registration found in public web results. Manually verify at nafdac.gov.ng.',
      }
    }

    // Look for a registration number pattern in the snippets.
    for (const hit of hits) {
      const text = `${hit.title ?? ''} ${hit.snippet ?? ''}`
      const match = text.match(NAFDAC_REG_PATTERN)
      if (match) {
        return {
          regulator: 'NAFDAC',
          country: 'Nigeria',
          status: 'registered',
          registrationNumber: match[1],
          productUrl: hit.url,
          notes: 'NAFDAC registration number found in public web results. Verify at nafdac.gov.ng.',
        }
      }
    }

    // No number found, but we have results — inconclusive.
    return {
      regulator: 'NAFDAC',
      country: 'Nigeria',
      status: 'unknown',
      productUrl: hits[0].url,
      notes: 'Web results mention this product but no NAFDAC registration number was found. Manually verify at nafdac.gov.ng.',
    }
  },
}

// ---------------------------------------------------------------------------
// Registry + generic fallback for other African regulators.
// ---------------------------------------------------------------------------

export const REGULATORS: Record<string, Regulator> = {
  NG: nafdacRegulator,
}

const COUNTRY_REGULATOR_NAMES: Record<string, string> = {
  GH: 'FDA Ghana',
  KE: 'PPB Kenya',
  UG: 'NDA Uganda',
  ZA: 'SAHPRA',
  TZ: 'TMDA',
  EG: 'EDA',
  MA: 'ANAM',
}

export function getRegulator(countryCode?: string): Regulator {
  const code = (countryCode || '').toUpperCase()
  const specific = REGULATORS[code]
  if (specific) return specific

  const name = COUNTRY_REGULATOR_NAMES[code] ?? 'National drug regulator'
  return {
    id: `generic-${code || 'xx'}`,
    name,
    country: code || 'unknown',
    async search(brand, productName) {
      const query = `${name} "${brand}"${productName ? ` "${productName}"` : ''} registered approved`
      const res = await runWebSearch(query, 4)
      const hits = res.results ?? res.data ?? []
      if (hits.length === 0) {
        return {
          regulator: name,
          country: code || 'unknown',
          status: 'not_found',
          notes: `No public registration found via web search. Verify directly with ${name}.`,
        }
      }
      return {
        regulator: name,
        country: code || 'unknown',
        status: 'unknown',
        productUrl: hits[0].url,
        notes: `Web results found mentioning this product; verify registration directly with ${name}.`,
      }
    },
  }
}

export async function lookupRegulator(
  brand: string,
  productName?: string,
  countryCode?: string
): Promise<RegulatorResult> {
  const reg = getRegulator(countryCode)
  return reg.search(brand, productName)
}
