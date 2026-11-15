import { describe, expect, it } from 'bun:test'
import { translations, detectLocale, SUPPORTED_LOCALES, LOCALE_LABELS } from '../translations'

describe('translations', () => {
  it('has English and French locales', () => {
    expect(SUPPORTED_LOCALES).toContain('en')
    expect(SUPPORTED_LOCALES).toContain('fr')
  })

  it('has labels for all supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeTruthy()
    }
  })

  it('has the same keys in English and French', () => {
    const enKeys = Object.keys(translations.en).sort()
    const frKeys = Object.keys(translations.fr).sort()
    expect(frKeys).toEqual(enKeys)
  })

  it('has no empty values in English', () => {
    for (const [, value] of Object.entries(translations.en)) {
      expect(value).toBeTruthy()
    }
  })

  it('has no empty values in French', () => {
    for (const [, value] of Object.entries(translations.fr)) {
      expect(value).toBeTruthy()
    }
  })

  it('includes key UI strings', () => {
    expect(translations.en['mode.quickScan']).toBeTruthy()
    expect(translations.en['mode.deepCompare']).toBeTruthy()
    expect(translations.en['verdict.likelyAuthentic']).toBeTruthy()
    expect(translations.en['verdict.highRisk']).toBeTruthy()
    expect(translations.en['onboarding.verifyTitle']).toBeTruthy()
  })

  it('has different values for en vs fr on at least some keys', () => {
    const someKey = 'mode.quickScan'
    expect(translations.en[someKey]).not.toBe(translations.fr[someKey])
  })
})

describe('detectLocale', () => {
  it('returns en by default on server', () => {
    expect(detectLocale()).toBe('en')
  })
})
