'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ScanLine, Users, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

const ONBOARDING_KEY = 'authverify_onboarded'

const SLIDES: Array<{ icon: React.ComponentType<{ className?: string }>; titleKey: string; bodyKey: string; accent: string }> = [
  {
    icon: ShieldCheck,
    titleKey: 'onboarding.verifyTitle',
    bodyKey: 'onboarding.verifyBody',
    accent: 'text-amber-400',
  },
  {
    icon: ScanLine,
    titleKey: 'onboarding.twoWaysTitle',
    bodyKey: 'onboarding.twoWaysBody',
    accent: 'text-emerald-400',
  },
  {
    icon: Users,
    titleKey: 'onboarding.communityTitle',
    bodyKey: 'onboarding.communityBody',
    accent: 'text-emerald-400',
  },
]

export function Onboarding() {
  const [slide, setSlide] = useState(0)
  const t = useT()

  // Check if already onboarded (client-only).
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(true)
    }
  }, [])

  if (dismissed) return null

  const isLast = slide === SLIDES.length - 1
  const current = SLIDES[slide]
  const Icon = current.icon

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(ONBOARDING_KEY, '1')
      setDismissed(true)
    } else {
      setSlide(slide + 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950/95 backdrop-blur-sm">
      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute right-4 top-4 z-10 rounded-full p-2 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
        aria-label={t('onboarding.skip')}
      >
        <X className="h-5 w-5" />
      </button>

      {/* Slide content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-6 rounded-2xl bg-zinc-900 p-6 ring-1 ring-inset ring-zinc-800">
          <Icon className={cn('h-12 w-12', current.accent)} />
        </div>
        <h2 className="mb-3 text-xl font-bold text-zinc-100">{t(current.titleKey)}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-zinc-400">{t(current.bodyKey)}</p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pb-4">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === slide ? 'w-6 bg-amber-400' : 'w-1.5 bg-zinc-700'
            )}
          />
        ))}
      </div>

      {/* Action button */}
      <div className="px-8 pb-8">
        <Button
          onClick={handleNext}
          className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400"
          size="lg"
        >
          {isLast ? t('onboarding.startScanning') : t('onboarding.next')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
