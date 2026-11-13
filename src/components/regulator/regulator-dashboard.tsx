'use client'

import { useEffect, useState } from 'react'
import { Shield, TrendingUp, MapPin, AlertTriangle, CheckCircle2, Loader2, Package, Building2, BadgeCheck, XCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'

interface DashboardData {
  configured: boolean
  totalScans?: number
  verdictBreakdown?: Array<{ verdict: string; count: number }>
  topBrands?: Array<{ brand: string; count: number }>
  hotspots?: Array<{ region: string; count: number }>
  pendingReports?: Array<{
    id: string
    brand: string
    product_name: string | null
    region: string | null
    details_json: unknown
    created_at: string
  }>
  pendingReportCount?: number
}

interface PendingManufacturer {
  id: string
  company_name: string
  country: string
  contact_email: string
  phone: string | null
  regulatory_license_number: string | null
  website: string | null
  verified: boolean
  created_at: string
  productCount: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RegulatorDashboard({ open, onOpenChange }: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingManufacturers, setPendingManufacturers] = useState<PendingManufacturer[]>([])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      fetch('/api/regulator/dashboard').then((r) => r.json()),
      fetch('/api/regulator/verify-manufacturer').then((r) => r.json()),
    ])
      .then(([d, mfgRes]) => {
        setData(d)
        setPendingManufacturers(mfgRes.manufacturers ?? [])
      })
      .catch(() => toast({ title: 'Failed to load dashboard', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [open, toast])

  const handleModerate = async (reportId: string, action: 'verify' | 'dismiss') => {
    try {
      const res = await fetch('/api/community/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, action }),
      })
      if (!res.ok) throw new Error('Moderation failed')
      toast({
        title: action === 'verify' ? 'Report verified' : 'Report dismissed',
      })
      const fresh = await fetch('/api/regulator/dashboard').then((r) => r.json())
      setData(fresh)
    } catch {
      toast({ title: 'Moderation failed', variant: 'destructive' })
    }
  }

  const handleVerifyManufacturer = async (manufacturerId: string, verified: boolean) => {
    try {
      const res = await fetch('/api/regulator/verify-manufacturer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturerId, verified }),
      })
      if (!res.ok) throw new Error('Verification failed')
      toast({
        title: verified ? 'Manufacturer verified' : 'Manufacturer rejected',
        description: verified
          ? 'They now have the verified badge on their products.'
          : 'Their products will show as unverified.',
      })
      // Refresh pending manufacturers.
      const mfgRes = await fetch('/api/regulator/verify-manufacturer').then((r) => r.json())
      setPendingManufacturers(mfgRes.manufacturers ?? [])
    } catch {
      toast({ title: 'Verification failed', variant: 'destructive' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-zinc-950 border-zinc-800 p-0">
        <SheetHeader className="px-4 py-3 border-b border-zinc-800">
          <SheetTitle className="flex items-center gap-2 text-zinc-100">
            <Shield className="h-5 w-5 text-amber-400" />
            Regulator Dashboard
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex h-[70vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </div>
        )}

        {!loading && data && !data.configured && (
          <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <Shield className="h-10 w-10 text-zinc-700" />
            <h3 className="text-base font-semibold text-zinc-300">Supabase not connected</h3>
            <p className="max-w-xs text-sm text-zinc-500">
              The regulator dashboard requires Supabase. Add credentials and run the schema to enable counterfeit hotspot analytics, brand report trends, and community report moderation.
            </p>
          </div>
        )}

        {!loading && data && data.configured && (
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <div className="space-y-4 p-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total scans" value={data.totalScans ?? 0} icon={Package} />
                <StatCard label="Pending reports" value={data.pendingReportCount ?? 0} icon={AlertTriangle} accent="amber" />
              </div>

              {/* Verdict breakdown */}
              {data.verdictBreakdown && data.verdictBreakdown.length > 0 && (
                <div className="rounded-lg bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                    Verdict breakdown
                  </h4>
                  <div className="space-y-2">
                    {data.verdictBreakdown.map((v) => {
                      const total = data.totalScans ?? 1
                      const pct = Math.round((v.count / total) * 100)
                      const color = v.verdict === 'likely_authentic' ? 'bg-emerald-500' :
                                    v.verdict === 'high_risk_counterfeit' ? 'bg-red-500' : 'bg-amber-500'
                      const label = v.verdict === 'likely_authentic' ? 'Likely authentic' :
                                    v.verdict === 'high_risk_counterfeit' ? 'High-risk counterfeit' : 'Inconclusive'
                      return (
                        <div key={v.verdict}>
                          <div className="flex justify-between text-xs text-zinc-400">
                            <span>{label}</span>
                            <span className="font-mono">{v.count} ({pct}%)</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Top reported brands */}
              {data.topBrands && data.topBrands.length > 0 && (
                <div className="rounded-lg bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <TrendingUp className="h-4 w-4 text-amber-400" />
                    Most-reported brands
                  </h4>
                  <ul className="space-y-1">
                    {data.topBrands.map((b, i) => (
                      <li key={b.brand} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300"><span className="text-zinc-600 mr-2">{i + 1}.</span>{b.brand}</span>
                        <Badge variant="outline" className="border-zinc-700 text-zinc-400">{b.count} reports</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Counterfeit hotspots by region */}
              {data.hotspots && data.hotspots.length > 0 && (
                <div className="rounded-lg bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <MapPin className="h-4 w-4 text-amber-400" />
                    Counterfeit hotspots
                  </h4>
                  <ul className="space-y-1">
                    {data.hotspots.map((h) => (
                      <li key={h.region} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-zinc-300"><MapPin className="h-3 w-3 text-zinc-600" />{h.region}</span>
                        <Badge variant="outline" className="border-zinc-700 text-zinc-400">{h.count}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Moderation queue */}
              {data.pendingReports && data.pendingReports.length > 0 && (
                <div className="rounded-lg bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Pending reports ({data.pendingReports.length})
                  </h4>
                  <ul className="space-y-2">
                    {data.pendingReports.map((r) => {
                      const details = r.details_json as { note?: string } | null
                      return (
                        <li key={r.id} className="rounded-md bg-zinc-950/50 p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-zinc-200">{r.brand}</p>
                              {r.product_name && <p className="truncate text-[11px] text-zinc-500">{r.product_name}</p>}
                              {details?.note && <p className="mt-0.5 text-[11px] text-zinc-600 line-clamp-2">{details.note}</p>}
                              {r.region && <p className="mt-0.5 text-[10px] text-zinc-600">{r.region}</p>}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleModerate(r.id, 'verify')} className="h-7 px-2 text-[11px] text-emerald-400 hover:bg-emerald-500/10">
                                Verify
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleModerate(r.id, 'dismiss')} className="h-7 px-2 text-[11px] text-red-400 hover:bg-red-500/10">
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {data.pendingReports && data.pendingReports.length === 0 && (
                <div className="rounded-lg bg-zinc-900 p-6 text-center ring-1 ring-inset ring-zinc-800">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/50" />
                  <p className="mt-2 text-sm text-zinc-400">No pending reports. The queue is clear.</p>
                </div>
              )}

              {/* Manufacturer verification queue */}
              {pendingManufacturers.length > 0 && (
                <div className="rounded-lg bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <Building2 className="h-4 w-4 text-amber-400" />
                    Manufacturer verification queue ({pendingManufacturers.length})
                  </h4>
                  <ul className="space-y-2">
                    {pendingManufacturers.map((m) => (
                      <li key={m.id} className="rounded-md bg-zinc-950/50 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-zinc-200">{m.company_name}</p>
                            <p className="text-[11px] text-zinc-500">{m.country} · {m.productCount} product(s)</p>
                            {m.regulatory_license_number && (
                              <p className="text-[11px] text-zinc-600">License: {m.regulatory_license_number}</p>
                            )}
                            {m.website && (
                              <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-[11px] text-amber-400 hover:text-amber-300">
                                {m.website}
                              </a>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleVerifyManufacturer(m.id, true)} className="h-7 px-2 text-[11px] text-emerald-400 hover:bg-emerald-500/10">
                              <BadgeCheck className="mr-0.5 h-3 w-3" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleVerifyManufacturer(m.id, false)} className="h-7 px-2 text-[11px] text-red-400 hover:bg-red-500/10">
                              <XCircle className="mr-0.5 h-3 w-3" /> Reject
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; accent?: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 p-3 ring-1 ring-inset ring-zinc-800">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
        <Icon className={`h-3 w-3 ${accent === 'amber' ? 'text-amber-400' : 'text-zinc-500'}`} />
        {label}
      </div>
      <p className="mt-1 text-xl font-bold text-zinc-100">{value.toLocaleString()}</p>
    </div>
  )
}
