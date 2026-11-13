'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X, ScanLine, Camera, CameraOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
}

/**
 * Camera-based barcode scanner using @zxing/browser.
 * Works on every phone with a camera — no cable needed.
 * Detects EAN-13, UPC-A, Code-128, QR codes, and other common formats.
 */
export function BarcodeScanner({ open, onOpenChange, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'error'>('idle')
  const [error, setError] = useState('')
  const [lastScan, setLastScan] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      // Stop the scanner when the dialog closes.
      controlsRef.current?.stop()
      controlsRef.current = null
      return
    }

    let cancelled = false
    // Camera/scanner init is a legitimate external-system sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('starting')
    setError('')

    const start = async () => {
      try {
        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader
        // Wait for the video element to mount.
        await new Promise((r) => setTimeout(r, 50))
        if (cancelled || !videoRef.current) return

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              const text = result.getText().trim()
              if (text && text !== lastScan) {
                setLastScan(text)
                // Brief vibration feedback if supported.
                if (navigator.vibrate) navigator.vibrate(100)
                onScan(text)
              }
            }
          }
        )
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setStatus('live')
      } catch (err) {
        const e = err as Error
        setStatus('error')
        setError(e.message || 'Could not start the camera for barcode scanning.')
      }
    }
    start()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open, onScan, lastScan])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-black transition-opacity',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <ScanLine className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-medium">Scan barcode</span>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="rounded-full bg-black/40 p-2 text-white hover:bg-black/70"
          aria-label="Close scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Video feed */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {/* Scan reticle */}
        {status === 'live' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-32 w-[80%] max-w-sm overflow-hidden rounded-lg border-2 border-amber-400/70">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 animate-pulse bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            </div>
          </div>
        )}

        {status === 'live' && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-center text-xs text-white backdrop-blur">
            Point at the product barcode
          </div>
        )}

        {/* Status overlays */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
            <p className="text-sm">Starting camera…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <CameraOff className="h-8 w-8 text-zinc-500" />
            <p className="max-w-xs text-sm text-zinc-300">{error}</p>
            <Button
              variant="outline"
              onClick={() => {
                setStatus('starting')
                setError('')
                // Re-trigger the effect by toggling open.
                onOpenChange(false)
                setTimeout(() => onOpenChange(true), 100)
              }}
              className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              <Camera className="mr-2 h-4 w-4" /> Retry
            </Button>
          </div>
        )}
      </div>

      {/* Last scan feedback */}
      {lastScan && status === 'live' && (
        <div className="bg-emerald-500/10 px-4 py-2 text-center text-xs text-emerald-300">
          Scanned: {lastScan}
        </div>
      )}
    </div>
  )
}
