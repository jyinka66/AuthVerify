'use client'

import { ShieldCheck, ShieldAlert, ShieldQuestion, Volume2, VolumeX } from 'lucide-react'
import type { ScanRecord, Verdict } from '@/lib/scan/types'
import { FlagList } from './flag-list'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface Props {
  scan: ScanRecord
  onReport?: () => void
  onRescan?: () => void
}

const VERDICT_META: Record<Verdict, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  ring: string
  text: string
  bg: string
  desc: string
}> = {
  likely_authentic: {
    label: 'Likely Authentic',
    icon: ShieldCheck,
    ring: 'text-emerald-400',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    desc: 'No major red flags detected. Treat as a preliminary check, not a guarantee.',
  },
  high_risk_counterfeit: {
    label: 'High Risk — Likely Counterfeit',
    icon: ShieldAlert,
    ring: 'text-red-400',
    text: 'text-red-300',
    bg: 'bg-red-500/10',
    desc: 'Multiple red flags detected. Do not use this product. Report it to protect others.',
  },
  inconclusive: {
    label: 'Inconclusive',
    icon: ShieldQuestion,
    ring: 'text-amber-400',
    text: 'text-amber-300',
    bg: 'bg-amber-500/10',
    desc: 'Not enough evidence to reach a verdict. Try Deep Compare for a stronger check.',
  },
}

export function VerdictCard({ scan, onReport, onRescan }: Props) {
  const meta = VERDICT_META[scan.verdict]
  const Icon = meta.icon
  const [readAloud, setReadAloud] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    if (!readAloud) {
      window.speechSynthesis.cancel()
      // Toggling readAloud off must update the speaking flag for the UI.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpeaking(false)
      return
    }
    const utter = new SpeechSynthesisUtterance(
      `${meta.label}. Confidence ${scan.confidenceScore} percent. ${scan.reasoning}`
    )
    utter.onend = () => { setSpeaking(false); setReadAloud(false) }
    utter.onerror = () => { setSpeaking(false); setReadAloud(false) }
    setSpeaking(true)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [readAloud, scan.reasoning, scan.confidenceScore, meta.label])

  const detected = [scan.brandDetected, scan.productNameDetected, scan.packSizeDetected]
    .filter(Boolean).join(' — ')

  return (
    <div className="space-y-4">
      {/* Verdict header */}
      <div className={cn('rounded-xl p-4 ring-1 ring-inset', meta.bg, 'ring-zinc-800')}>
        <div className="flex items-start gap-3">
          <Icon className={cn('mt-0.5 h-7 w-7 shrink-0', meta.ring)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className={cn('text-lg font-bold leading-tight', meta.text)}>
                {meta.label}
              </h2>
              <button
                onClick={() => setReadAloud((v) => !v)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                aria-label={readAloud ? 'Stop reading aloud' : 'Read verdict aloud'}
                title={readAloud ? 'Stop reading aloud' : 'Read verdict aloud'}
              >
                {speaking || readAloud ? (
                  <Volume2 className="h-4 w-4 text-amber-400" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </button>
            </div>
            {detected && (
              <p className="mt-0.5 truncate text-sm text-zinc-300">{detected}</p>
            )}
            <p className="mt-1 text-xs text-zinc-400">{meta.desc}</p>
          </div>
        </div>

        {/* Confidence meter */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Confidence</span>
            <span className="font-mono text-zinc-200">{scan.confidenceScore}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                scan.verdict === 'likely_authentic' && 'bg-emerald-500',
                scan.verdict === 'high_risk_counterfeit' && 'bg-red-500',
                scan.verdict === 'inconclusive' && 'bg-amber-500'
              )}
              style={{ width: `${scan.confidenceScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <div className="rounded-xl bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Why this verdict
        </h3>
        <p className="text-sm leading-relaxed text-zinc-200">{scan.reasoning}</p>
      </div>

      {/* Flags */}
      {scan.flags.length > 0 && <FlagList flags={scan.flags} />}

      {/* Actions */}
      <div className="flex gap-2">
        {scan.verdict === 'high_risk_counterfeit' && onReport && (
          <Button
            onClick={onReport}
            className="flex-1 bg-red-500 text-white hover:bg-red-400"
          >
            <ShieldAlert className="mr-2 h-4 w-4" /> Report this fake
          </Button>
        )}
        {onRescan && (
          <Button
            onClick={onRescan}
            variant="outline"
            className="flex-1 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
          >
            Scan another
          </Button>
        )}
      </div>
    </div>
  )
}
