import type { ProductCategory } from './types'
import { getCategoryMeta } from './categories'

/**
 * VLM system prompt for Quick Scan (single-frame live authenticity analysis).
 * The model returns a strict JSON object so we can parse flags programmatically.
 */
export function buildQuickScanPrompt(categoryId: ProductCategory | null): string {
  const meta = categoryId ? getCategoryMeta(categoryId) : null
  const hints = meta?.verificationHints ?? []
  const categoryContext = meta
    ? `Product category: ${meta.label}. ${meta.description}.`
    : 'Product category: unknown — detect from the image.'

  return `You are a counterfeit product detection expert specializing in African and global consumer markets.

${categoryContext}
${hints.length ? `Focus verification on these indicators: ${hints.join(', ')}.` : ''}

Analyze the product image for authenticity indicators. Examine:
- Brand logo quality (printing sharpness, correct colors, proportions)
- Packaging print quality (clarity, registration, no smudging)
- Font mismatches (wrong typeface, off-brand typography)
- Spelling errors on labels (counterfeits frequently have typos)
- Hologram presence and quality (where applicable)
- Color accuracy (compare to expected brand colors)
- Serial / batch / NAFDAC number format and presence
- Security features (foils, seals, watermarks, microprint)
- Packaging seal integrity
- Manufacturing quality indicators (mold marks, material feel visible in image)

Return a STRICT JSON object with EXACTLY this shape (no markdown, no extra text):
{
  "verdict": "likely_authentic" | "high_risk_counterfeit" | "inconclusive",
  "confidenceScore": <integer 0-100>,
  "brandDetected": "<string or null>",
  "productNameDetected": "<string or null>",
  "packSizeDetected": "<string or null>",
  "flags": [
    {
      "kind": "red_flag" | "positive_indicator",
      "category": "<short snake_case key, e.g. hologram_missing, font_mismatch, nafdac_number_valid>",
      "description": "<one-sentence plain-language explanation>",
      "severity": "low" | "medium" | "high"
    }
  ],
  "reasoning": "<2-3 sentence plain-language summary of why you reached this verdict>"
}

Rules:
- Be honest about uncertainty. If evidence is weak, return "inconclusive" with a low confidenceScore.
- Never claim 100% certainty. Cap confidenceScore at 95 even when evidence is strong.
- Always include at least 2 flags (mix of red flags and positive indicators when possible).
- The reasoning must be non-technical and understandable by a consumer with no expertise.
- If you cannot read the image or it's not a product, return verdict "inconclusive", confidenceScore 0, and a flag explaining the image is unreadable.`
}

/**
 * VLM system prompt for Deep Compare (suspect photo vs. genuine reference images).
 * The suspect photo is the FIRST image; reference images follow.
 * When manufacturer-provided security features are available, they are
 * included as explicit check items (ground truth from the brand owner).
 */
export function buildDeepComparePrompt(
  categoryId: ProductCategory | null,
  referenceCount: number,
  manufacturerSecurityFeatures?: Array<{ feature: string; location: string; description: string }>,
  manufacturerFakeIndicators?: Array<{ indicator: string; description: string }>
): string {
  const meta = categoryId ? getCategoryMeta(categoryId) : null
  const categoryContext = meta
    ? `Product category: ${meta.label}. ${meta.description}.`
    : 'Product category: unknown.'

  const securityFeaturesSection = manufacturerSecurityFeatures && manufacturerSecurityFeatures.length > 0
    ? `\n\nThe manufacturer has specified these official security features to verify. Check each one explicitly:\n${manufacturerSecurityFeatures.map((f, i) => `${i + 1}. ${f.feature} at ${f.location}: ${f.description}`).join('\n')}\n\nIf ALL listed security features are present and correct, this strongly indicates authenticity. If ANY are missing or incorrect, this strongly indicates counterfeit.`
    : ''

  const fakeIndicatorsSection = manufacturerFakeIndicators && manufacturerFakeIndicators.length > 0
    ? `\n\nThe manufacturer has reported these known counterfeit indicators. Check for each one:\n${manufacturerFakeIndicators.map((f, i) => `${i + 1}. ${f.indicator}: ${f.description}`).join('\n')}\n\nIf ANY of these counterfeit indicators are present, this strongly indicates counterfeit.`
    : ''

  const trustNote = (manufacturerSecurityFeatures?.length || manufacturerFakeIndicators?.length)
    ? '\n\nIMPORTANT: The reference images and security features for this comparison were provided directly by the product manufacturer (ground truth), not web-scraped. This is the highest-trust verification source.'
    : ''

  return `You are a counterfeit product detection expert comparing a SUSPECTED product against GENUINE reference images.

${categoryContext}

The FIRST image is the user's suspected product. The following ${referenceCount} image(s) are genuine reference images${manufacturerSecurityFeatures?.length ? ' provided by the product manufacturer (official ground truth)' : ' sourced from the web (manufacturer sites, retailers, regulatory databases, marketplaces)'}.

For each reference image, identify specific differences between the suspect and the genuine reference:
- Brand logo (shape, color, position, print quality)
- Packaging design and layout
- Color accuracy
- Font and typography
- Hologram / security feature presence
- Print quality
- Seal / packaging integrity
- Batch / serial number format
- Any spelling differences
${securityFeaturesSection}${fakeIndicatorsSection}${trustNote}

Return a STRICT JSON object with EXACTLY this shape (no markdown, no extra text):
{
  "verdict": "likely_authentic" | "high_risk_counterfeit" | "inconclusive",
  "confidenceScore": <integer 0-100>,
  "brandDetected": "<string or null>",
  "productNameDetected": "<string or null>",
  "packSizeDetected": "<string or null>",
  "flags": [
    {
      "kind": "red_flag" | "positive_indicator",
      "category": "<short snake_case key>",
      "description": "<one-sentence plain-language explanation>",
      "severity": "low" | "medium" | "high"
    }
  ],
  "reasoning": "<2-3 sentence plain-language summary referencing the comparison>",
  "comparisonNotes": [
    "<one observation per reference image, describing key differences or matches>"
  ]
}

Rules:
- If the suspect matches all genuine references closely, return "likely_authentic" with high confidence.
- If the suspect differs from genuine references in multiple ways (especially logos, holograms, spelling), return "high_risk_counterfeit".
- If reference images are inconsistent with each other or low quality, lower confidence and possibly return "inconclusive".
- Never claim 100% certainty. Cap confidenceScore at 95.
- Reasoning must reference the comparison (e.g. "the suspect's logo is offset compared to the genuine reference, and the hologram is missing").`
}

/**
 * Prompt to extract product identifying info from a suspect photo
 * (used in Deep Compare step 1 before constructing the web search query).
 */
export function buildExtractionPrompt(): string {
  return `You are a product identification expert. Read the product image and extract identifying information for a counterfeit verification search.

Return a STRICT JSON object with EXACTLY this shape (no markdown, no extra text):
{
  "brand": "<brand name as printed, or null>",
  "productName": "<product name as printed, or null>",
  "packSize": "<pack size / variant as printed, e.g. '200ml', '60 tablets', or null>",
  "category": "<best-guess category: medicine_otc | medicine_antimalarial | medicine_prescription | medicine_supplement | cosmetic | beverage | packaged_food | electronics_accessory | electronics_device | household_good | apparel | auto_consumable | currency | other_branded>",
  "visibleText": "<any other notable text visible: batch numbers, NAFDAC numbers, expiry, country of origin>"
}

If the image is not a product or is unreadable, return {"brand": null, "productName": null, "packSize": null, "category": "other_branded", "visibleText": null}.`
}
