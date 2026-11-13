'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ScanLine, GitCompareArrows, ScanSearch, History, ShieldCheck, Loader2, AlertCircle, Database, Barcode, Plug, Bell, Info } from 'lucide-react'
import { CameraView } from '@/components/scan/camera-view'
import { PhotoCapture } from '@/components/scan/photo-capture'
import { CategoryPicker } from '@/components/scan/category-picker'
import { VerdictCard } from '@/components/scan/verdict-card'
import { ComparisonCard } from '@/components/scan/comparison-card'
import { ProgressOverlay } from '@/components/scan/progress-overlay'
import { ScanHistory } from '@/components/scan/scan-history'
import { CommunityReportForm } from '@/components/scan/community-report-form'
import { BarcodeScanner } from '@/components/scan/barcode-scanner'
import { BarcodeResultSheet } from '@/components/scan/barcode-result-sheet'
import { ScannerWizard } from '@/components/hardware/scanner-wizard'
import { AlertsFeed } from '@/components/scan/alerts-feed'
import { AuthButton } from '@/components/auth/auth-button'
import { LegalDialog } from '@/components/legal/legal-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  ProductCategory,
  ScanRecord,
  DeepCompareProgress,
  ScanMode,
} from '@/lib/scan/types'
import { quickScan, deepCompare, listHistory, deleteScan, lookupProduct, type ProductLookupResponse } from '@/lib/scan/api-client'
import { listLocalScans, saveLocalScan, deleteLocalScan, isUsingLocalStore } from '@/lib/scan/store-local'
import { getDeviceFingerprint, detectRegion } from '@/lib/scan/device'
import { useCommunityAlerts } from '@/hooks/use-community-alerts'
import { useToast } from '@/hooks/use-toast'

type Screen = 'capture' | 'analyzing' | 'result'

export default function Home() {
  const { toast } = useToast()

  // Device identity (declared early — region feeds the alerts hook).
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('anon')
  const [region, setRegion] = useState<string | undefined>(undefined)

  const [mode, setMode] = useState<ScanMode>('quick')
  const [category, setCategory] = useState<ProductCategory | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('capture')
  const [result, setResult] = useState<ScanRecord | null>(null)
  const [history, setHistory] = useState<ScanRecord[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [usingLocalStore, setUsingLocalStore] = useState(false)

  // Barcode scanner (camera) + hardware scanner wizard.
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false)
  const [scannerWizardOpen, setScannerWizardOpen] = useState(false)
  const [hardwareConnected, setHardwareConnected] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [barcodeSheetOpen, setBarcodeSheetOpen] = useState(false)
  const [barcodeLookup, setBarcodeLookup] = useState<{
    loading: boolean
    product?: ProductLookupResponse['product']
    regulator?: ProductLookupResponse['regulator']
    error?: string
  }>({ loading: false })

  // Community counterfeit alerts (real-time via socket.io).
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)
  const { connected: alertsConnected, alerts, dismissAlert, clearAlerts } = useCommunityAlerts(region)

  // Deep Compare SSE progress.
  const [deepProgress, setDeepProgress] = useState<DeepCompareProgress | null>(null)
  const [visibleStages, setVisibleStages] = useState<Set<DeepCompareProgress['stage']>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

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

  // Show a toast when a new community alert arrives.
  const lastAlertCount = useRef(0)
  useEffect(() => {
    if (alerts.length > lastAlertCount.current && lastAlertCount.current !== 0) {
      const latest = alerts[0]
      toast({
        title: 'Counterfeit alert nearby',
        description: `${latest.brand}${latest.productName ? ` — ${latest.productName}` : ''} was reported as fake${latest.region ? ` in ${latest.region}` : ''}.`,
      })
    }
    lastAlertCount.current = alerts.length
  }, [alerts, toast])

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

  // --- Barcode scan handler (shared by camera scanner + hardware scanner) ---
  const handleBarcodeScan = async (code: string) => {
    setBarcodeScannerOpen(false)
    setScannedBarcode(code)
    setBarcodeSheetOpen(true)
    setBarcodeLookup({ loading: true })
    try {
      const res = await lookupProduct(code, region)
      setBarcodeLookup({
        loading: false,
        product: res.product,
        regulator: res.regulator,
      })
    } catch (err) {
      setBarcodeLookup({
        loading: false,
        error: err instanceof Error ? err.message : 'Lookup failed.',
      })
    }
  }

  // --- After barcode lookup: pre-fill category + brand and switch to visual verification ---
  const handleVerifyVisuallyFromBarcode = () => {
    if (barcodeLookup.product) {
      // Best-effort category inference from the lookup category text.
      const cat = (barcodeLookup.product.category ?? '').toLowerCase()
      let inferred: ProductCategory | null = null
      if (cat.includes('medic') || cat.includes('pharma')) inferred = 'medicine_otc'
      else if (cat.includes('cosmetic') || cat.includes('beauty')) inferred = 'cosmetic'
      else if (cat.includes('beverage') || cat.includes('drink')) inferred = 'beverage'
      else if (cat.includes('food') || cat.includes('snack')) inferred = 'packaged_food'
      else if (cat.includes('electronic')) inferred = 'electronics_accessory'
      if (inferred) setCategory(inferred)
    }
    setBarcodeSheetOpen(false)
    resetToCapture()
  }

  // Track hardware scanner connection status for the header badge.
  const handleHardwareScan = (code: string) => {
    setHardwareConnected(true)
    handleBarcodeScan(code)
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

        <div className="flex items-center gap-1.5">
          {usingLocalStore && (
            <span
              className="hidden items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400 sm:flex"
              title="Supabase not configured — scans are saved on this device only"
            >
              <Database className="h-3 w-3" />
              Local
            </span>
          )}
          {hardwareConnected && (
            <span
              className="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 sm:flex"
              title="Hardware barcode scanner connected"
            >
              <Plug className="h-3 w-3" />
              Scanner
            </span>
          )}
          <AuthButton />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setScannerWizardOpen(true)}
            className="text-zinc-300 hover:bg-zinc-900 hover:text-white"
            aria-label="Connect hardware scanner"
            title="Connect a USB or Bluetooth barcode scanner"
          >
            <Plug className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setBarcodeScannerOpen(true)}
            className="text-zinc-300 hover:bg-zinc-900 hover:text-white"
            aria-label="Scan barcode with camera"
            title="Scan a product barcode with your camera"
          >
            <Barcode className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAlertsOpen(true)}
            className="relative text-zinc-300 hover:bg-zinc-900 hover:text-white"
            aria-label="Community alerts"
            title="Community counterfeit alerts"
          >
            <Bell className="h-5 w-5" />
            {alerts.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            )}
            {alertsConnected && alerts.length === 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHistoryOpen(true)}
            className="text-zinc-300 hover:bg-zinc-900 hover:text-white"
            aria-label="Scan history"
          >
            <History className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLegalOpen(true)}
            className="text-zinc-300 hover:bg-zinc-900 hover:text-white"
            aria-label="Legal & privacy"
            title="Disclaimer, privacy policy, terms"
          >
            <Info className="h-5 w-5" />
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

      {/* Camera barcode scanner */}
      <BarcodeScanner
        open={barcodeScannerOpen}
        onOpenChange={setBarcodeScannerOpen}
        onScan={handleBarcodeScan}
      />

      {/* Hardware scanner wizard (USB / Type-C / Bluetooth) */}
      <ScannerWizard
        open={scannerWizardOpen}
        onOpenChange={setScannerWizardOpen}
        onScan={handleHardwareScan}
      />

      {/* Barcode lookup result sheet */}
      <BarcodeResultSheet
        open={barcodeSheetOpen}
        onOpenChange={setBarcodeSheetOpen}
        barcode={scannedBarcode}
        lookup={barcodeLookup}
        onVerifyVisually={handleVerifyVisuallyFromBarcode}
      />

      {/* Community counterfeit alerts feed (real-time via socket.io) */}
      <AlertsFeed
        open={alertsOpen}
        onOpenChange={setAlertsOpen}
        connected={alertsConnected}
        alerts={alerts}
        onDismiss={dismissAlert}
        onClear={clearAlerts}
      />

      {/* Legal & privacy dialog */}
      <LegalDialog open={legalOpen} onOpenChange={setLegalOpen} />
    </div>
  )
}
