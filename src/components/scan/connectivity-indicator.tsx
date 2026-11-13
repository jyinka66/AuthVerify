'use client'

import { Wifi, WifiOff, Loader2, CheckCircle2, CloudUpload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  online: boolean
  queuedCount: number
  processing: boolean
}

/**
 * Compact connectivity + queue indicator for the header. Shows:
 * - Online/offline status
 * - Number of queued offline scans (if any)
 * - Processing spinner when the queue is being flushed
 */
export function ConnectivityIndicator({ online, queuedCount, processing }: Props) {
  if (processing) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        Syncing {queuedCount}
      </span>
    )
  }

  if (!online) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400" title="You are offline. Scans will be queued and processed when you reconnect.">
        <WifiOff className="h-3 w-3" />
        Offline{queuedCount > 0 && ` · ${queuedCount} queued`}
      </span>
    )
  }

  if (queuedCount > 0) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300" title={`${queuedCount} scans queued for processing`}>
        <CloudUpload className="h-3 w-3" />
        {queuedCount} queued
      </span>
    )
  }

  // Online with no queue — show a subtle "online" indicator (hidden on small screens).
  return (
    <span className="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 sm:flex" title="Connected">
      <Wifi className="h-3 w-3" />
      Online
    </span>
  )
}
