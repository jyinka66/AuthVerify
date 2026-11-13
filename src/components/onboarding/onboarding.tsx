'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ScanLine, Users, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ONBOARDING_KEY = 'authverify_onboarded'

interface Slide {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  accent: string
}

const SLIDES: Slide[] = [
  {
    icon: ShieldCheck,
    title: 'Verify any product in seconds',
    body: 'Point your camera at a medicine, cosmetic, beverage, or any branded product. AuthVerify checks for counterfeit red flags using AI vision analysis.',
    accent: 'text-amber-400',
  },
  {
    icon: ScanLine,
    title: 'Two ways to check',
    body: 'Quick Scan analyzes your photo instantly. Deep Compare searches the web for genuine reference images and compares your photo side-by-side with the real thing.',
    accent: 'text-emerald-400',
  },
  {
    icon: Users,
    title: 'Protect your community',
    body: 'When you spot a fake, report it. Other users nearby get alerted instantly. Together we can push counterfeits out of the market — every report makes the app smarter for everyone.',
    accent: 'text-emerald-400',
  },
]

export function Onboarding() {
  const [slide, setSlide] = useState(0)

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
        aria-label="Skip onboarding"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Slide content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-6 rounded-2xl bg-zinc-900 p-6 ring-1 ring-inset ring-zinc-800">
          <Icon className={cn('h-12 w-12', current.accent)} />
        </div>
        <h2 className="mb-3 text-xl font-bold text-zinc-100">{current.title}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-zinc-400">{current.body}</p>
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
          {isLast ? 'Start scanning' : 'Next'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
