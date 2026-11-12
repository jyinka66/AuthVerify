'use client'

import { useEffect, useState } from 'react'
import { ShieldAlert, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { submitReport } from '@/lib/scan/api-client'
import { useToast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill: {
    brand?: string
    productName?: string
    region?: string
  }
  deviceFingerprint: string
  onSubmitted?: () => void
}

export function CommunityReportForm({
  open,
  onOpenChange,
  prefill,
  deviceFingerprint,
  onSubmitted,
}: Props) {
  const [brand, setBrand] = useState(prefill.brand ?? '')
  const [productName, setProductName] = useState(prefill.productName ?? '')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  // Sync prefill whenever the dialog opens or prefill changes.
  useEffect(() => {
    if (open) {
      setBrand(prefill.brand ?? '')
      setProductName(prefill.productName ?? '')
      setDetails('')
    }
  }, [open, prefill.brand, prefill.productName])

  const handleSubmit = async () => {
    if (!brand.trim()) {
      toast({ title: 'Brand is required', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await submitReport({
        brand: brand.trim(),
        productName: productName.trim() || undefined,
        region: prefill.region,
        details: details.trim() || undefined,
        deviceFingerprint,
      })
      toast({
        title: res.usingLocalStore ? 'Report saved locally' : 'Report submitted',
        description: res.usingLocalStore
          ? 'Connect Supabase to share with the community.'
          : 'Thank you — your report helps other users avoid this fake.',
      })
      onOpenChange(false)
      onSubmitted?.()
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            Report a counterfeit
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Your report helps other users in your region avoid this fake. Reports are anonymous — your identity is not shared.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="brand" className="text-zinc-300">Brand *</Label>
            <Input
              id="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Panadol"
              className="bg-zinc-900 border-zinc-800 text-zinc-100"
            />
          </div>
          <div>
            <Label htmlFor="product" className="text-zinc-300">Product name</Label>
            <Input
              id="product"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Extra 500mg tablets"
              className="bg-zinc-900 border-zinc-800 text-zinc-100"
            />
          </div>
          <div>
            <Label htmlFor="details" className="text-zinc-300">What made you suspect it?</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. The hologram was missing and the expiry date was smudged…"
              rows={4}
              className="bg-zinc-900 border-zinc-800 text-zinc-100 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !brand.trim()}
            className="bg-red-500 text-white hover:bg-red-400"
          >
            <Send className="mr-2 h-4 w-4" />
            {submitting ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
