'use client'

import { Loader2, Search, ImageIcon, GitCompare, Database, ShieldCheck, AlertCircle } from 'lucide-react'
import type { DeepCompareProgress } from '@/lib/scan/types'
import { cn } from '@/lib/utils'

interface Props {
  progress: DeepCompareProgress | null
  visibleStages: Set<DeepCompareProgress['stage']>
}

const STAGE_META: Record<DeepCompareProgress['stage'], {
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  extracting: { label: 'Reading product details', icon: Search },
  cache_check: { label: 'Checking cached references', icon: Database },
  searching: { label: 'Searching the web', icon: Search },
  references_found: { label: 'Genuine references found', icon: ImageIcon },
  caching: { label: 'Caching for future scans', icon: Database },
  comparing: { label: 'Comparing photos', icon: GitCompare },
  verdict: { label: 'Finalizing verdict', icon: ShieldCheck },
  error: { label: 'Error', icon: AlertCircle },
}

const ORDER: DeepCompareProgress['stage'][] = [
  'extracting', 'cache_check', 'searching', 'references_found', 'caching', 'comparing', 'verdict',
]

export function ProgressOverlay({ progress, visibleStages }: Props) {
  if (!progress) return null

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-5 ring-1 ring-inset ring-zinc-800">
        <div className="mb-4 flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100">Verifying…</p>
            <p className="truncate text-xs text-zinc-400">{progress.message}</p>
          </div>
        </div>

        <ol className="space-y-2">
          {ORDER.map((stage) => {
            if (!visibleStages.has(stage)) return null
            const meta = STAGE_META[stage]
            const Icon = meta.icon
            const isCurrent = progress.stage === stage && progress.stage !== 'verdict' && progress.stage !== 'error'
            const isDone = ORDER.indexOf(progress.stage) > ORDER.indexOf(stage) || progress.stage === 'verdict'
            const isError = progress.stage === 'error' && stage === 'error'

            return (
              <li
                key={stage}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs',
                  isCurrent && 'bg-amber-500/10',
                  isError && 'bg-red-500/10'
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isCurrent && 'animate-pulse text-amber-400',
                    isDone && !isError && 'text-emerald-400',
                    !isCurrent && !isDone && !isError && 'text-zinc-600',
                    isError && 'text-red-400'
                  )}
                />
                <span
                  className={cn(
                    'font-medium',
                    isCurrent && 'text-amber-200',
                    isDone && !isError && 'text-zinc-300',
                    !isCurrent && !isDone && !isError && 'text-zinc-600',
                    isError && 'text-red-300'
                  )}
                >
                  {meta.label}
                </span>
                {isDone && !isError && (
                  <span className="ml-auto text-emerald-400">✓</span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
