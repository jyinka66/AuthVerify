'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { translations, detectLocale, type Locale, SUPPORTED_LOCALES, LOCALE_LABELS } from './translations'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
  locales: Locale[]
  labels: Record<Locale, string>
}

const I18nContext = createContext<I18nContextValue | null>(null)

const LOCALE_STORAGE_KEY = 'authverify_locale'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? (localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null)
      : null
    if (stored && SUPPORTED_LOCALES.includes(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(stored)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(detectLocale())
    }
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
    }
  }, [])

  const t = useCallback((key: string): string => {
    return translations[locale]?.[key] ?? translations.en[key] ?? key
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, locales: SUPPORTED_LOCALES, labels: LOCALE_LABELS }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Fallback for components used outside the provider (shouldn't happen in practice).
    return {
      locale: 'en',
      setLocale: () => {},
      t: (key: string) => translations.en[key] ?? key,
      locales: SUPPORTED_LOCALES,
      labels: LOCALE_LABELS,
    }
  }
  return ctx
}

/** Convenience hook that returns just the translation function. */
export function useT() {
  return useI18n().t
}
