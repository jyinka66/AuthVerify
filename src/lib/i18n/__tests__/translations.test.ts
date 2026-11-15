import { describe, expect, it } from 'bun:test'
import { translations, detectLocale, SUPPORTED_LOCALES, LOCALE_LABELS } from '../translations'

describe('translations', () => {
  it('has English, French, Portuguese, and Swahili locales', () => {
    expect(SUPPORTED_LOCALES).toContain('en')
    expect(SUPPORTED_LOCALES).toContain('fr')
    expect(SUPPORTED_LOCALES).toContain('pt')
    expect(SUPPORTED_LOCALES).toContain('sw')
  })

  it('has labels for all supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeTruthy()
    }
  })

  it('has the same keys across all locales', () => {
    const enKeys = Object.keys(translations.en).sort()
    for (const locale of SUPPORTED_LOCALES) {
      const localeKeys = Object.keys(translations[locale]).sort()
      expect(localeKeys).toEqual(enKeys)
    }
  })

  it('has no empty values in any locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const [, value] of Object.entries(translations[locale])) {
        expect(value).toBeTruthy()
      }
    }
  })

  it('includes key UI strings', () => {
    expect(translations.en['mode.quickScan']).toBeTruthy()
    expect(translations.en['mode.deepCompare']).toBeTruthy()
    expect(translations.en['verdict.likelyAuthentic']).toBeTruthy()
    expect(translations.en['verdict.highRisk']).toBeTruthy()
    expect(translations.en['onboarding.verifyTitle']).toBeTruthy()
  })

  it('has different values across locales on at least some keys', () => {
    const someKey = 'mode.quickScan'
    expect(translations.en[someKey]).not.toBe(translations.fr[someKey])
    expect(translations.en[someKey]).not.toBe(translations.pt[someKey])
    expect(translations.en[someKey]).not.toBe(translations.sw[someKey])
  })
})

describe('detectLocale', () => {
  it('returns en by default on server', () => {
    expect(detectLocale()).toBe('en')
  })
})
