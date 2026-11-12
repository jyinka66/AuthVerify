'use client'

import { useRef, useState } from 'react'
import { Upload, Camera, RefreshCw, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  image: string | null
  onCapture: (imageDataUrl: string | null) => void
  className?: string
}

/**
 * Deep Compare photo input. Accepts a fresh camera snapshot or a file upload
 * from the gallery. Shows a brief quality hint before capture.
 */
export function PhotoCapture({ image, onCapture, className }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') onCapture(result)
    }
    reader.readAsDataURL(file)
  }

  if (image) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
        <img src={image} alt="Captured product" className="h-full w-full object-contain" />
        <button
          onClick={() => onCapture(null)}
          className="absolute right-4 top-4 rounded-full bg-black/60 p-2.5 text-white backdrop-blur hover:bg-black/80"
          aria-label="Retake photo"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-center text-xs text-white backdrop-blur">
          Review your photo — is the product sharp, well-lit, and filling the frame?
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-6 bg-zinc-950 p-6 text-center',
        dragOver && 'bg-zinc-900',
        className
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file && file.type.startsWith('image/')) readFile(file)
      }}
    >
      <div className="rounded-full bg-zinc-900 p-5 ring-1 ring-zinc-800">
        <ImageIcon className="h-8 w-8 text-amber-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Snap or upload a product photo</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-400">
          Deep Compare searches the web for genuine reference images and checks your photo against them. Take a clear, well-lit, straight-on shot of the packaging.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          onClick={() => cameraInputRef.current?.click()}
          className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
          size="lg"
        >
          <Camera className="mr-2 h-5 w-5" /> Take a photo
        </Button>
        <Button
          onClick={() => fileRef.current?.click()}
          variant="outline"
          className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
        >
          <Upload className="mr-2 h-4 w-4" /> Upload from gallery
        </Button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
          e.target.value = ''
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
