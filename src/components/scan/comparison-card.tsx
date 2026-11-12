'use client'

import { ExternalLink, ShieldCheck, ImageOff } from 'lucide-react'
import type { ReferenceImage } from '@/lib/scan/types'
import { cn } from '@/lib/utils'

interface Props {
  suspectImage: string | undefined
  references: ReferenceImage[]
}

const SOURCE_LABEL: Record<string, string> = {
  manufacturer: 'Manufacturer',
  retailer: 'Retailer',
  regulatory: 'Regulatory',
  marketplace: 'Marketplace',
  unknown: 'Web',
}

export function ComparisonCard({ suspectImage, references }: Props) {
  if (!references.length) return null

  return (
    <div className="rounded-xl bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-300">
        <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
        Compared against genuine references
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {/* Suspect photo (left) */}
        <figure className="overflow-hidden rounded-lg bg-zinc-950 ring-1 ring-inset ring-zinc-800">
          <div className="aspect-square w-full overflow-hidden">
            {suspectImage ? (
              <img src={suspectImage} alt="Your photo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-600">
                <ImageOff className="h-6 w-6" />
              </div>
            )}
          </div>
          <figcaption className="px-2 py-1.5 text-[11px] font-medium text-amber-300">
            Your photo (suspect)
          </figcaption>
        </figure>

        {/* Best reference (right) */}
        <figure className="overflow-hidden rounded-lg bg-zinc-950 ring-1 ring-inset ring-zinc-800">
          <div className="aspect-square w-full overflow-hidden">
            <img
              src={references[0].imageUrl}
              alt="Genuine reference"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
          <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px]">
            <span className="truncate font-medium text-emerald-300">
              {SOURCE_LABEL[references[0].sourceType]}
            </span>
            <span className="font-mono text-zinc-500">{references[0].credibilityScore}</span>
          </figcaption>
        </figure>
      </div>

      {/* All references list */}
      {references.length > 1 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            All {references.length} references used
          </p>
          <ul className="space-y-1">
            {references.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-zinc-950/60 px-2 py-1.5 text-xs"
              >
                <span className="flex items-center gap-1.5 truncate text-zinc-300">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      r.sourceType === 'regulatory' || r.sourceType === 'manufacturer'
                        ? 'bg-emerald-400'
                        : r.sourceType === 'marketplace'
                          ? 'bg-amber-400'
                          : 'bg-zinc-500'
                    )}
                  />
                  <span className="truncate">{SOURCE_LABEL[r.sourceType]}</span>
                  {r.caption && (
                    <span className="truncate text-zinc-500">— {r.caption}</span>
                  )}
                </span>
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-zinc-500 hover:text-amber-400"
                  aria-label="Open source"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
