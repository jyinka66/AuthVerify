import { describe, expect, it } from 'bun:test'
import { buildQuickScanPrompt, buildDeepComparePrompt, buildExtractionPrompt } from '../prompts'

describe('buildQuickScanPrompt', () => {
  it('includes category context when provided', () => {
    const prompt = buildQuickScanPrompt('medicine_otc')
    expect(prompt).toContain('Medicine — OTC')
    expect(prompt).toContain('NAFDAC number')
  })

  it('includes auto-detect when no category', () => {
    const prompt = buildQuickScanPrompt(null)
    expect(prompt).toContain('unknown')
    expect(prompt).toContain('detect from the image')
  })

  it('always includes the JSON output format', () => {
    const prompt = buildQuickScanPrompt('cosmetic')
    expect(prompt).toContain('STRICT JSON')
    expect(prompt).toContain('verdict')
    expect(prompt).toContain('confidenceScore')
    expect(prompt).toContain('flags')
  })

  it('always includes the 95% cap rule', () => {
    const prompt = buildQuickScanPrompt('beverage')
    expect(prompt).toContain('95')
  })

  it('includes verification hints for the category', () => {
    const prompt = buildQuickScanPrompt('medicine_antimalarial')
    expect(prompt).toContain('WHO prequalification')
    expect(prompt).toContain('blister seal')
  })
})

describe('buildDeepComparePrompt', () => {
  it('includes the reference count', () => {
    const prompt = buildDeepComparePrompt(null, 5)
    expect(prompt).toContain('5')
    expect(prompt).toContain('image(s)')
  })

  it('includes manufacturer security features when provided', () => {
    const prompt = buildDeepComparePrompt(null, 2, [
      { feature: 'Hologram', location: 'top right', description: 'Embossed holographic seal' },
    ])
    expect(prompt).toContain('Hologram')
    expect(prompt).toContain('top right')
    expect(prompt).toContain('Embossed holographic seal')
    expect(prompt).toContain('manufacturer')
    expect(prompt).toContain('ground truth')
  })

  it('includes manufacturer fake indicators when provided', () => {
    const prompt = buildDeepComparePrompt(null, 2, undefined, [
      { indicator: 'Misspelling', description: 'Counterfeits misspell pharmaceutical as pharmaceutica' },
    ])
    expect(prompt).toContain('Misspelling')
    expect(prompt).toContain('pharmaceutica')
  })

  it('does not include manufacturer section when not provided', () => {
    const prompt = buildDeepComparePrompt(null, 3)
    expect(prompt).not.toContain('ground truth')
  })

  it('always includes the JSON output format', () => {
    const prompt = buildDeepComparePrompt('cosmetic', 4)
    expect(prompt).toContain('STRICT JSON')
    expect(prompt).toContain('comparisonNotes')
  })
})

describe('buildExtractionPrompt', () => {
  it('includes all expected fields', () => {
    const prompt = buildExtractionPrompt()
    expect(prompt).toContain('brand')
    expect(prompt).toContain('productName')
    expect(prompt).toContain('packSize')
    expect(prompt).toContain('category')
    expect(prompt).toContain('visibleText')
  })

  it('includes the category enum', () => {
    const prompt = buildExtractionPrompt()
    expect(prompt).toContain('medicine_otc')
    expect(prompt).toContain('cosmetic')
    expect(prompt).toContain('other_branded')
  })
})
