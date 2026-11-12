'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ScanLine, GitCompareArrows, ScanSearch, History, ShieldCheck, Loader2, AlertCircle, Database } from 'lucide-react'
import { CameraView } from '@/components/scan/camera-view'
import { PhotoCapture } from '@/components/scan/photo-capture'
import { CategoryPicker } from '@/components/scan/category-picker'
import { VerdictCard } from '@/components/scan/verdict-card'
import { ComparisonCard } from '@/components/scan/comparison-card'
import { ProgressOverlay } from '@/components/scan/progress-overlay'
import { ScanHistory } from '@/components/scan/scan-history'
import { CommunityReportForm } from '@/components/scan/community-report-form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  ProductCategory,
  ScanRecord,
  DeepCompareProgress,
  ScanMode,
} from '@/lib/scan/types'
import { quickScan, deepCompare, listHistory, deleteScan } from '@/lib/scan/api-client'
import { listLocalScans, saveLocalScan, deleteLocalScan, isUsingLocalStore } from '@/lib/scan/store-local'
import { getDeviceFingerprint, detectRegion } from '@/lib/scan/device'
import { useToast } from '@/hooks/use-toast'

type Screen = 'capture' | 'analyzing' | 'result'

export default function Home() {
  const [mode, setMode] = useState<ScanMode>('quick')
  const [category, setCategory] = useState<ProductCategory | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('capture')
  const [result, setResult] = useState<ScanRecord | null>(null)
  const [history, setHistory] = useState<ScanRecord[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [usingLocalStore, setUsingLocalStore] = useState(false)

  // Deep Compare SSE progress.
  const [deepProgress, setDeepProgress] = useState<DeepCompareProgress | null>(null)
  const [visibleStages, setVisibleStages] = useState<Set<DeepCompareProgress['stage']>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  // Device identity (client-only).
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('anon')
  const [region, setRegion] = useState<string | undefined>(undefined)

  const { toast } = useToast()

  // Init device fingerprint + region + history on mount.
  useEffect(() => {
    const fp = getDeviceFingerprint()
    setDeviceFingerprint(fp)
    const reg = detectRegion()
    setRegion(reg)
    setUsingLocalStore(isUsingLocalStore())

    // If Supabase isn't configured, load local history immediately.
    if (isUsingLocalStore()) {
      setHistory(listLocalScans())
      return
    }
    // Otherwise fetch from the server.
    listHistory(fp, reg)
      .then((res) => {
        setHistory(res.scans)
        setUsingLocalStore(res.usingLocalStore)
        // Also seed local cache so history shows instantly next time.
      })
      .catch(() => {
        setHistory(listLocalScans())
      })
  }, [])

  const resetToCapture = () => {
    setResult(null)
    setCapturedImage(null)
    setDeepProgress(null)
    setVisibleStages(new Set())
    setScreen('capture')
    abortRef.current?.abort()
    abortRef.current = null
  }

  const switchMode = (m: ScanMode) => {
    setMode(m)
    resetToCapture()
  }

  // --- Quick Scan: capture frame + immediately send to API ---
  const handleQuickCapture = async (imageDataUrl: string) => {
    setCapturedImage(imageDataUrl)
    setScreen('analyzing')
    try {
      const res = await quickScan({
        image: imageDataUrl,
        category,
        deviceFingerprint,
        region,
      })
      setResult(res.scan)
      setUsingLocalStore(res.usingLocalStore)
      setHistory((prev) => [res.scan, ...prev].slice(0, 50))
      if (res.usingLocalStore) saveLocalScan(res.scan)
      setScreen('result')
    } catch (err) {
      toast({
        title: 'Scan failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
      resetToCapture()
    }
  }

  // --- Deep Compare: send photo, stream SSE progress ---
  const handleDeepCompare = async () => {
    if (!capturedImage) return
    setScreen('analyzing')
    setDeepProgress({ stage: 'extracting', message: 'Starting verification…' })
    setVisibleStages(new Set(['extracting']))

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await deepCompare({
        image: capturedImage,
        category,
        deviceFingerprint,
        region,
        signal: controller.signal,
        onProgress: (p) => {
          setDeepProgress(p)
          setVisibleStages((prev) => {
            const next = new Set(prev)
            next.add(p.stage)
            return next
          })
        },
      })
      setResult(res.scan)
      setUsingLocalStore(res.usingLocalStore)
      setHistory((prev) => [res.scan, ...prev].slice(0, 50))
      if (res.usingLocalStore) saveLocalScan(res.scan)
      setScreen('result')
    } catch (err) {
      if (controller.signal.aborted) {
        resetToCapture()
        return
      }
      toast({
        title: 'Verification failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
      resetToCapture()
    } finally {
      abortRef.current = null
    }
  }

  const handleDeleteScan = async (id: string) => {
    // Optimistic update.
    setHistory((prev) => prev.filter((s) => s.id !== id))
    if (usingLocalStore) {
      deleteLocalScan(id)
    } else {
      await deleteScan(id).catch(() => {})
    }
  }

  const showReportForm = () => {
    if (!result) return
    setReportOpen(true)
  }

  const analyzing = screen === 'analyzing'
  const showProgress = mode === 'deep' && analyzing && deepProgress

  const primaryAction = useMemo(() => {
    if (screen === 'result') {
      return {
        label: 'Scan another product',
        icon: ScanSearch,
        onClick: resetToCapture,
        variant: 'outline' as const,
      }
    }
    if (mode === 'quick') {
      return {
        label: analyzing ? 'Analyzing…' : 'Tap to scan',
        icon: analyzing ? Loader2 : ScanLine,
        onClick: () => {}, // capture happens via camera tap; button is visual
        variant: 'default' as const,
      }
    }
    // Deep compare
    return {
      label: capturedImage ? (analyzing ? 'Verifying…' : 'Verify against originals') : 'Take or upload a photo first',
      icon: GitCompareArrows,
      onClick: handleDeepCompare,
      variant: 'default' as const,
      disabled: !capturedImage || analyzing,
    }
  }, [screen, mode, analyzing, capturedImage])

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-zinc-950">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-none">
            <h1 className="text-base font-bold tracking-tight">AuthVerify</h1>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Counterfeit detection co-pilot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {usingLocalStore && (
            <span
              className="hidden items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400 sm:flex"
              title="Supabase not configured — scans are saved on this device only"
            >
              <Database className="h-3 w-3" />
              Local
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHistoryOpen(true)}
            className="text-zinc-300 hover:bg-zinc-900 hover:text-white"
            aria-label="Scan history"
          >
            <History className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Mode switcher */}
      <div className="flex items-center justify-center gap-1 border-b border-zinc-900 bg-zinc-950 px-4 py-2">
        <div className="inline-flex rounded-lg bg-zinc-900 p-0.5 ring-1 ring-inset ring-zinc-800">
          <button
            onClick={() => switchMode('quick')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'quick' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
            )}
          >
            <ScanLine className="h-3.5 w-3.5" />
            Quick Scan
          </button>
          <button
            onClick={() => switchMode('deep')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'deep' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
            )}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Deep Compare
          </button>
        </div>
      </div>

      {/* Main capture area */}
      <main className="relative flex min-h-[calc(100vh-3.5rem-2.75rem-5rem)] flex-1 flex-col">
        {/* Category picker — floating top-left */}
        <div className="absolute left-3 top-3 z-10">
          <CategoryPicker value={category} onChange={setCategory} />
        </div>

        {screen === 'capture' && mode === 'quick' && (
          <CameraView onCapture={handleQuickCapture} className="flex-1" />
        )}

        {screen === 'capture' && mode === 'deep' && (
          <PhotoCapture image={capturedImage} onCapture={setCapturedImage} className="flex-1" />
        )}

        {analyzing && mode === 'quick' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-black">
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Analyzing"
                className="max-h-[60vh] w-full object-contain opacity-80"
              />
            )}
            <div className="flex items-center gap-3 text-zinc-300">
              <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
              <span className="text-sm">Analyzing your photo…</span>
            </div>
          </div>
        )}

        {analyzing && mode === 'deep' && (
          <div className="relative flex flex-1 items-center justify-center bg-black">
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Verifying"
                className="max-h-[60vh] w-full object-contain opacity-40"
              />
            )}
            <ProgressOverlay progress={deepProgress} visibleStages={visibleStages} />
          </div>
        )}

        {screen === 'result' && result && (
          <div className="flex-1 overflow-y-auto bg-zinc-950">
            <div className="mx-auto max-w-2xl space-y-4 p-4 pb-6">
              {capturedImage && (
                <div className="overflow-hidden rounded-xl ring-1 ring-inset ring-zinc-800">
                  <img
                    src={capturedImage}
                    alt="Your scan"
                    className="max-h-64 w-full object-cover"
                  />
                </div>
              )}

              <VerdictCard
                scan={result}
                onReport={showReportForm}
                onRescan={resetToCapture}
              />

              {mode === 'deep' && result.referenceImages && result.referenceImages.length > 0 && (
                <ComparisonCard
                  suspectImage={capturedImage ?? undefined}
                  references={result.referenceImages}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Sticky footer with primary action */}
      <footer className="sticky bottom-0 z-20 border-t border-zinc-900 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {screen === 'result' ? (
            <Button
              onClick={primaryAction.onClick}
              variant={primaryAction.variant}
              className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              <primaryAction.icon className="mr-2 h-4 w-4" />
              {primaryAction.label}
            </Button>
          ) : mode === 'quick' ? (
            <div className="flex w-full items-center justify-center gap-1.5 text-xs text-zinc-500">
              <AlertCircle className="h-3.5 w-3.5" />
              Center the product, then tap the amber button below
            </div>
          ) : (
            <Button
              onClick={primaryAction.onClick}
              disabled={'disabled' in primaryAction && primaryAction.disabled}
              className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400"
            >
              <primaryAction.icon className={cn('mr-2 h-4 w-4', analyzing && 'animate-spin')} />
              {primaryAction.label}
            </Button>
          )}
        </div>
      </footer>

      {/* History drawer */}
      <ScanHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        scans={history}
        onSelect={(scan) => {
          setResult(scan)
          setCapturedImage(scan.suspectImageUrl ?? null)
          setMode(scan.mode)
          setScreen('result')
          setHistoryOpen(false)
        }}
        onDelete={handleDeleteScan}
      />

      {/* Community report dialog */}
      <CommunityReportForm
        open={reportOpen}
        onOpenChange={setReportOpen}
        prefill={{
          brand: result?.brandDetected,
          productName: result?.productNameDetected,
          region,
        }}
        deviceFingerprint={deviceFingerprint}
        onSubmitted={resetToCapture}
      />
    </div>
  )
}
