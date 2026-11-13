'use client'

import { useState } from 'react'
import { BellRing, BellOff, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { cn } from '@/lib/utils'

/**
 * Push notification subscription toggle. Shows a bell icon that lets
 * the user enable or disable push notifications for counterfeit alerts.
 * Hidden when push isn't supported (iOS Safari, older browsers).
 */
export function PushNotificationToggle() {
  const { supported, permission, subscribed, subscribe } = usePushNotifications()
  const [busy, setBusy] = useState(false)

  if (!supported) return null

  const isOn = permission === 'granted' && subscribed

  const handleClick = async () => {
    setBusy(true)
    try {
      await subscribe()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy || isOn}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium transition-colors',
        isOn
          ? 'bg-emerald-500/10 text-emerald-300'
          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-amber-300'
      )}
      title={isOn ? 'Push notifications enabled' : 'Enable push notifications for counterfeit alerts'}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isOn ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <BellRing className="h-3 w-3" />
      )}
      {isOn ? 'Alerts on' : 'Enable alerts'}
    </button>
  )
}
