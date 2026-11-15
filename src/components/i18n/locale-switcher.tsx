'use client'

import { Globe, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LocaleSwitcher() {
  const { locale, setLocale, locales, labels } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-amber-300"
        aria-label="Change language"
        title="Change language"
      >
        <Globe className="h-3 w-3" />
        {locale.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-32 rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false) }}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                l === locale ? 'bg-amber-500/10 text-amber-300' : 'text-zinc-300 hover:bg-zinc-900'
              )}
            >
              {labels[l]}
              {l === locale && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
