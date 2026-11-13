'use client'

import { Barcode, Loader2, Package, Building2, ExternalLink, ShieldCheck, ShieldAlert, ShieldQuestion, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BarcodeLookupResult } from '@/lib/scan/barcode'
import type { RegulatorResult } from '@/lib/scan/regulators'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  barcode: string | null
  lookup: { loading: boolean; product?: BarcodeLookupResult; regulator?: RegulatorResult | null; error?: string }
  onVerifyVisually: () => void
}

const STATUS_META = {
  registered: { label: 'Registered', icon: ShieldCheck, cls: 'text-emerald-300 bg-emerald-500/10' },
  not_found: { label: 'Not found', icon: ShieldAlert, cls: 'text-red-300 bg-red-500/10' },
  unknown: { label: 'Unverified', icon: ShieldQuestion, cls: 'text-amber-300 bg-amber-500/10' },
}

export function BarcodeResultSheet({ open, onOpenChange, barcode, lookup, onVerifyVisually }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5 text-amber-400" />
            Product lookup
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {barcode && (
              <>
                Barcode: <span className="font-mono text-zinc-300">{barcode}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {lookup.loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            <p className="text-sm text-zinc-400">Looking up the product…</p>
          </div>
        )}

        {!lookup.loading && lookup.error && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {lookup.error}
          </div>
        )}

        {!lookup.loading && !lookup.error && lookup.product && (
          <div className="space-y-3">
            {/* Product card */}
            <div className="flex gap-3 rounded-lg bg-zinc-900 p-3 ring-1 ring-inset ring-zinc-800">
              {lookup.product.imageUrl ? (
                <img
                  src={lookup.product.imageUrl}
                  alt="Product"
                  className="h-16 w-16 shrink-0 rounded-md object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-zinc-800">
                  <Package className="h-6 w-6 text-zinc-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
                  <span>
                    {lookup.product.source === 'openfoodfacts'
                      ? 'OpenFoodFacts'
                      : lookup.product.source === 'web_search'
                        ? 'Web search'
                        : 'Unknown source'}
                  </span>
                  {lookup.product.found && (
                    <span className="text-emerald-400">· found</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm font-medium text-zinc-100">
                  {lookup.product.productName || 'Unknown product'}
                </p>
                {lookup.product.brand && (
                  <p className="truncate text-xs text-zinc-400">{lookup.product.brand}</p>
                )}
                {lookup.product.category && (
                  <p className="mt-0.5 truncate text-xs text-zinc-600">{lookup.product.category}</p>
                )}
              </div>
            </div>

            {/* Regulator status */}
            {lookup.regulator && (
              <div className="rounded-lg bg-zinc-900 p-3 ring-1 ring-inset ring-zinc-800">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-zinc-100">
                    {lookup.regulator.regulator}
                  </span>
                  <span className="text-xs text-zinc-500">({lookup.regulator.country})</span>
                  {(() => {
                    const meta = STATUS_META[lookup.regulator.status]
                    const Icon = meta.icon
                    return (
                      <Badge variant="outline" className={cn('ml-auto border-0', meta.cls)}>
                        <Icon className="mr-1 h-3 w-3" />
                        {meta.label}
                      </Badge>
                    )
                  })()}
                </div>
                {lookup.regulator.registrationNumber && (
                  <p className="mt-1.5 text-xs text-zinc-300">
                    Reg. No: <span className="font-mono text-amber-300">{lookup.regulator.registrationNumber}</span>
                  </p>
                )}
                {lookup.regulator.notes && (
                  <p className="mt-1 text-xs text-zinc-500">{lookup.regulator.notes}</p>
                )}
                {lookup.regulator.productUrl && (
                  <a
                    href={lookup.regulator.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                  >
                    Open source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {lookup.product.notes && !lookup.regulator && (
              <p className="text-xs text-zinc-500">{lookup.product.notes}</p>
            )}

            {!lookup.product.found && (
              <p className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                No product found for this barcode online. You can still verify the packaging visually.
              </p>
            )}
          </div>
        )}

        {!lookup.loading && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              Scan another
            </Button>
            <Button
              onClick={onVerifyVisually}
              className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
            >
              Verify visually
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
