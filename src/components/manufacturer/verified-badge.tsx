'use client'

import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  name?: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Verified manufacturer badge — a green checkmark pill that indicates the
 * manufacturer has been reviewed and approved by a regulator/platform admin.
 * Shows the manufacturer name when provided.
 */
export function VerifiedBadge({ name, size = 'sm', className }: Props) {
  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
  }
  const iconSizes = { sm: 'h-3 w-3', md: 'h-3.5 w-3.5' }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-emerald-500/10 font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
        sizes[size],
        className
      )}
      title={name ? `${name} is a verified manufacturer` : 'Verified manufacturer'}
    >
      <BadgeCheck className={iconSizes[size]} />
      {name ? (
        <span className="truncate">Verified · {name}</span>
      ) : (
        'Verified'
      )}
    </span>
  )
}

/**
 * Unverified badge — shows "Pending" for manufacturers not yet reviewed.
 */
export function UnverifiedBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-zinc-800 font-medium text-zinc-500',
        sizes[size]
      )}
      title="This manufacturer has not been verified yet"
    >
      Pending verification
    </span>
  )
}
