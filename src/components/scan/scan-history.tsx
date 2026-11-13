'use client'

import { History, Trash2, X, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { ScanRecord, Verdict } from '@/lib/scan/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  scans: ScanRecord[]
  onSelect?: (scan: ScanRecord) => void
  onDelete?: (id: string) => void
}

const VERDICT_ICON: Record<Verdict, React.ComponentType<{ className?: string }>> = {
  likely_authentic: ShieldCheck,
  high_risk_counterfeit: ShieldAlert,
  inconclusive: ShieldQuestion,
}

const VERDICT_COLOR: Record<Verdict, string> = {
  likely_authentic: 'text-emerald-400',
  high_risk_counterfeit: 'text-red-400',
  inconclusive: 'text-amber-400',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function ScanHistory({ open, onOpenChange, scans, onSelect, onDelete }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-zinc-950 border-zinc-800 p-0">
        <SheetHeader className="px-4 py-3 border-b border-zinc-800">
          <SheetTitle className="flex items-center gap-2 text-zinc-100">
            <History className="h-4 w-4 text-amber-400" />
            Scan history
          </SheetTitle>
        </SheetHeader>

        {scans.length === 0 ? (
          <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <History className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-400">
              No scans yet. Verify your first product and it will appear here.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <ul className="divide-y divide-zinc-900">
              {scans.map((scan) => {
                const Icon = VERDICT_ICON[scan.verdict]
                const detected = [scan.brandDetected, scan.productNameDetected]
                  .filter(Boolean).join(' — ') || 'Unknown product'
                return (
                  <li
                    key={scan.id}
                    className="group flex items-start gap-3 px-4 py-3 hover:bg-zinc-900"
                  >
                    <button
                      onClick={() => onSelect?.(scan)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', VERDICT_COLOR[scan.verdict])} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">{detected}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {scan.mode === 'deep' ? 'Deep Compare' : 'Quick Scan'} · {timeAgo(scan.createdAt)} · {scan.confidenceScore}%
                        </p>
                        {scan.flags.length > 0 && (
                          <p className="mt-1 truncate text-xs text-zinc-600">
                            {scan.flags.filter(f => f.kind === 'red_flag').length} red flags · {scan.flags.filter(f => f.kind === 'positive_indicator').length} positives
                          </p>
                        )}
                      </div>
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(scan.id)}
                        className="shrink-0 rounded-md p-1.5 text-zinc-600 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                        aria-label="Delete scan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
