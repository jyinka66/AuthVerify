'use client'

import { useEffect, useState } from 'react'
import { Usb, Bluetooth, Keyboard, CheckCircle2, AlertCircle, Loader2, Plug } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  createScanner,
  supportsHidKeyboard,
  supportsWebBluetooth,
  supportsWebSerial,
  type BarcodeScanner,
  type ScannerTransport,
} from '@/lib/scan/scanners'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
}

interface TransportOption {
  id: ScannerTransport
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  supported: boolean
  cableNote: string
}

const TRANSPORTS: TransportOption[] = [
  {
    id: 'hid',
    label: 'USB / Type-C scanner (keyboard mode)',
    description: 'For scanners that plug in and "type" the barcode. Most common — works with any cable.',
    icon: Keyboard,
    supported: true,
    cableNote: 'USB-A, Type-C, and OTG adapters all work.',
  },
  {
    id: 'webserial',
    label: 'USB / Type-C scanner (serial mode)',
    description: 'For scanners that output over a serial port. Uses WebSerial — Chrome or Edge only.',
    icon: Usb,
    supported: false,
    cableNote: 'Type-C to serial adapters (FTDI/CH340) supported.',
  },
  {
    id: 'web-bluetooth',
    label: 'Bluetooth scanner',
    description: 'For wireless BLE barcode scanners. Uses Web Bluetooth — Chrome or Edge only.',
    icon: Bluetooth,
    supported: false,
    cableNote: 'No cable — wireless.',
  },
]

export function ScannerWizard({ open, onOpenChange, onScan }: Props) {
  const [transports, setTransports] = useState<TransportOption[]>(TRANSPORTS)
  const [active, setActive] = useState<BarcodeScanner | null>(null)
  const [connecting, setConnecting] = useState<ScannerTransport | null>(null)
  const [connected, setConnected] = useState<ScannerTransport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recentScan, setRecentScan] = useState<string | null>(null)

  // Update support flags on mount (client-only APIs).
  useEffect(() => {
    setTransports((prev) =>
      prev.map((t) => ({
        ...t,
        supported:
          t.id === 'hid'
            ? supportsHidKeyboard()
            : t.id === 'webserial'
              ? supportsWebSerial()
              : supportsWebBluetooth(),
      }))
    )
  }, [])

  // Clean up active scanner when the dialog closes.
  useEffect(() => {
    if (!open && active) {
      active.stop()
      setActive(null)
      setConnected(null)
      setRecentScan(null)
      setError(null)
    }
  }, [open, active])

  const handleConnect = async (transport: ScannerTransport) => {
    setConnecting(transport)
    setError(null)
    try {
      // Stop any existing scanner first.
      if (active) {
        await active.stop()
        setActive(null)
        setConnected(null)
      }
      const scanner = createScanner(transport)
      await scanner.start((code) => {
        setRecentScan(code)
        onScan(code)
      })
      setActive(scanner)
      setConnected(transport)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect scanner.')
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async () => {
    if (active) {
      await active.stop()
      setActive(null)
      setConnected(null)
      setRecentScan(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-amber-400" />
            Connect a barcode scanner
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Plug a USB, Type-C, or Bluetooth barcode scanner into your phone to scan product barcodes faster than typing. The scanner stays connected across all verification modes.
          </DialogDescription>
        </DialogHeader>

        {connected && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 ring-1 ring-inset ring-emerald-500/30">
            <span className="flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Scanner connected — ready to scan
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="text-zinc-400 hover:text-red-400"
            >
              Disconnect
            </Button>
          </div>
        )}

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 ring-1 ring-inset ring-red-500/30">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {recentScan && (
          <div className="mb-3 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
            Last scan: <span className="font-mono text-amber-300">{recentScan}</span>
          </div>
        )}

        <div className="space-y-2">
          {transports.map((t) => {
            const Icon = t.icon
            const isConnecting = connecting === t.id
            const isConnected = connected === t.id
            return (
              <button
                key={t.id}
                disabled={!t.supported || isConnecting || Boolean(connected)}
                onClick={() => handleConnect(t.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
                  'bg-zinc-900 ring-1 ring-inset ring-zinc-800',
                  t.supported && !connected && 'hover:bg-zinc-800 hover:ring-zinc-700',
                  !t.supported && 'opacity-50',
                  isConnected && 'ring-emerald-500/40'
                )}
              >
                <div className={cn(
                  'mt-0.5 rounded-md p-1.5',
                  t.id === 'hid' && 'bg-zinc-800 text-zinc-300',
                  t.id === 'webserial' && 'bg-zinc-800 text-zinc-300',
                  t.id === 'web-bluetooth' && 'bg-zinc-800 text-zinc-300',
                  isConnected && 'bg-emerald-500/20 text-emerald-400'
                )}>
                  {isConnecting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isConnected ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">{t.label}</span>
                    {!t.supported && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                        Not supported here
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">{t.description}</p>
                  <p className="mt-1 text-[11px] text-zinc-600">{t.cableNote}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg bg-zinc-900 p-3 text-xs text-zinc-400">
          <p className="font-medium text-zinc-300">Cable & connector support</p>
          <p className="mt-1">
            USB-A, Type-C, and OTG adapters all work once the scanner is detected.
            iOS Safari only supports keyboard-mode scanners — for serial and Bluetooth
            scanners, use Chrome on Android or a desktop browser.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
