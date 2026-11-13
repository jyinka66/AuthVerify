'use client'

import { Pill, Shield, FileText, Leaf, Sparkles, CupSoda, Package, Plug, Smartphone, Home, Shirt, Car, Banknote, Tag, ChevronDown } from 'lucide-react'
import { PRODUCT_CATEGORIES } from '@/lib/scan/categories'
import type { ProductCategory } from '@/lib/scan/types'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Pill, Shield, FileText, Leaf, Sparkles, CupSoda, Package, Plug,
  Smartphone, Home, Shirt, Car, Banknote, Tag,
}

interface Props {
  value: ProductCategory | null
  onChange: (v: ProductCategory | null) => void
}

export function CategoryPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const selected = PRODUCT_CATEGORIES.find((c) => c.id === value)
  const Icon = selected ? ICONS[selected.icon] : Tag

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 bg-zinc-900/70 border-zinc-700 text-zinc-100 backdrop-blur hover:bg-zinc-800/80 hover:text-white"
        >
          <Icon className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium">
            {selected ? selected.label : 'Auto-detect'}
          </span>
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(92vw,360px)] bg-zinc-900 border-zinc-700 p-0"
        align="start"
      >
        <ScrollArea className="h-[min(60vh,420px)]">
          <div className="p-1">
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className={cn(
                'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-zinc-800',
                value === null && 'bg-amber-500/10'
              )}
            >
              <Tag className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <div className="font-medium text-zinc-100">Auto-detect</div>
                <div className="text-xs text-zinc-400">Let the AI identify the category from the image</div>
              </div>
            </button>
            {PRODUCT_CATEGORIES.map((c) => {
              const CatIcon = ICONS[c.icon] ?? Tag
              return (
                <button
                  key={c.id}
                  onClick={() => { onChange(c.id); setOpen(false) }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-zinc-800',
                    value === c.id && 'bg-amber-500/10'
                  )}
                >
                  <CatIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <div className="font-medium text-zinc-100">{c.label}</div>
                    <div className="text-xs text-zinc-400">{c.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
