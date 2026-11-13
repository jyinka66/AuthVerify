'use client'

import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { ScanFlag } from '@/lib/scan/types'
import { cn } from '@/lib/utils'

interface Props {
  flags: ScanFlag[]
}

const SEVERITY_STYLE: Record<string, string> = {
  low: 'border-l-zinc-500',
  medium: 'border-l-amber-500',
  high: 'border-l-red-500',
}

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

function humanize(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function FlagList({ flags }: Props) {
  const redFlags = flags.filter((f) => f.kind === 'red_flag')
  const positives = flags.filter((f) => f.kind === 'positive_indicator')

  return (
    <div className="space-y-3">
      {redFlags.length > 0 && (
        <div className="rounded-xl bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Red flags ({redFlags.length})
          </h3>
          <ul className="space-y-2">
            {redFlags.map((f, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-md border-l-2 bg-zinc-950/50 px-3 py-2',
                  SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.medium
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-100">
                    {humanize(f.category)}
                  </span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                    {SEVERITY_LABEL[f.severity]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-400">{f.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {positives.length > 0 && (
        <div className="rounded-xl bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Authenticity indicators ({positives.length})
          </h3>
          <ul className="space-y-2">
            {positives.map((f, i) => (
              <li
                key={i}
                className="rounded-md border-l-2 border-l-emerald-500 bg-zinc-950/50 px-3 py-2"
              >
                <span className="text-sm font-medium text-zinc-100">
                  {humanize(f.category)}
                </span>
                <p className="mt-0.5 text-xs text-zinc-400">{f.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
