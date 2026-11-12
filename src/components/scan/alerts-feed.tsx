'use client'

import { Radio, X, MapPin, Clock, Bell, BellOff } from 'lucide-react'
import { CommunityAlert } from '@/hooks/use-community-alerts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  connected: boolean
  alerts: CommunityAlert[]
  onDismiss: (id: string) => void
  onClear: () => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function AlertsFeed({ open, onOpenChange, connected, alerts, onDismiss, onClear }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-zinc-950 border-zinc-800 p-0">
        <SheetHeader className="px-4 py-3 border-b border-zinc-800">
          <SheetTitle className="flex items-center justify-between text-zinc-100">
            <span className="flex items-center gap-2">
              {connected ? (
                <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
              ) : (
                <BellOff className="h-4 w-4 text-zinc-600" />
              )}
              Community alerts
            </span>
            <Badge variant="outline" className={cn(
              'border-0 text-[10px]',
              connected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
            )}>
              {connected ? 'Live' : 'Offline'}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        {alerts.length === 0 ? (
          <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <Bell className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-400">
              {connected
                ? 'No alerts yet. You will be notified here when other users in your region report a counterfeit.'
                : 'Connecting to the community alert network…'}
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[calc(100vh-5rem)]">
              <ul className="divide-y divide-zinc-900">
                {alerts.map((alert) => (
                  <li key={alert.id} className="group px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                        <span className="text-xs">⚠️</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-100">
                          {alert.brand}
                          {alert.productName && (
                            <span className="text-zinc-400"> — {alert.productName}</span>
                          )}
                        </p>
                        {alert.details && (
                          <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">{alert.details}</p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-600">
                          {alert.region && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {alert.region}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {timeAgo(alert.createdAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onDismiss(alert.id)}
                        className="shrink-0 rounded-md p-1 text-zinc-600 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
                        aria-label="Dismiss alert"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <div className="border-t border-zinc-900 p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="w-full text-zinc-400 hover:text-zinc-200"
              >
                Clear all
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
