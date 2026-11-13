'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, CameraOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  onCapture: (imageDataUrl: string) => void
  className?: string
}

/**
 * Live rear-camera view for Quick Scan mode. Captures a still frame
 * to a data URL on tap. Falls back gracefully when camera permission
 * is denied or no camera is available.
 */
export function CameraView({ onCapture, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'idle' | 'requesting' | 'live' | 'denied' | 'error'>('idle')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState<string>('')

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setStatus('requesting')
    setError('')
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setStatus('live')
    } catch (err) {
      const e = err as DOMException
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        setStatus('denied')
        setError('Camera access was blocked. Tap the camera icon in your browser address bar to allow it.')
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setStatus('error')
        setError('No camera found on this device.')
      } else {
        setStatus('error')
        setError(e.message || 'Could not start the camera.')
      }
    }
  }, [stopStream])

  useEffect(() => {
    // Camera setup is a legitimate external-system sync (getUserMedia is async).
    // The 'requesting' status set inside startCamera is intentional UX feedback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera(facingMode)
    return stopStream
  }, [startCamera, stopStream, facingMode])

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas = document.createElement('canvas')
    const w = video.videoWidth || 1024
    const h = video.videoHeight || 1024
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    // JPEG at 0.85 keeps the payload reasonable for the API.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    onCapture(dataUrl)
  }, [onCapture])

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      <video
        ref={videoRef}
        playsInline
        muted
        className="h-full w-full object-cover"
      />

      {/* Framing reticle */}
      {status === 'live' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[70%] w-[80%] max-w-md rounded-2xl border-2 border-amber-400/60 shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
        </div>
      )}

      {/* Top hint */}
      {status === 'live' && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-center text-xs text-white backdrop-blur">
          Center the product inside the frame
        </div>
      )}

      {/* Flip camera button */}
      {status === 'live' && (
        <button
          onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
          className="absolute right-4 top-4 rounded-full bg-black/60 p-2.5 text-white backdrop-blur hover:bg-black/80"
          aria-label="Flip camera"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      )}

      {/* Capture button */}
      {status === 'live' && (
        <button
          onClick={capture}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/90 p-1.5 shadow-lg ring-4 ring-white/30 transition active:scale-95"
          aria-label="Capture and scan"
        >
          <span className="block h-14 w-14 rounded-full bg-amber-500" />
        </button>
      )}

      {/* Permission / error states */}
      {(status === 'denied' || status === 'error' || status === 'requesting') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-center">
          {status === 'requesting' ? (
            <>
              <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
              <p className="text-sm text-zinc-300">Starting camera…</p>
            </>
          ) : status === 'denied' || status === 'error' ? (
            <>
              <CameraOff className="h-8 w-8 text-zinc-500" />
              <p className="max-w-xs text-sm text-zinc-300">{error}</p>
              <Button
                variant="outline"
                onClick={() => startCamera(facingMode)}
                className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              >
                <Camera className="mr-2 h-4 w-4" /> Retry camera
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
