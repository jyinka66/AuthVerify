/**
 * Hardware scanner abstraction.
 *
 * Three transports are supported, in order of universal availability:
 * 1. HID keyboard — most USB/Type-C barcode scanners present as HID keyboards
 *    and just "type" the barcode + Enter. Works in any browser, no special API.
 * 2. WebSerial — for scanners that output over a serial port (USB-to-serial
 *    adapters, some industrial scanners). Chrome/Edge desktop + Android.
 * 3. Web Bluetooth — for BLE barcode scanners. Chrome/Edge desktop + Android.
 *
 * iOS Safari does not support WebSerial or WebUSB, so on iPhone only the HID
 * keyboard transport works (and camera scanning via @zxing).
 */

export type ScannerTransport = 'hid' | 'webserial' | 'web-bluetooth'

export interface ScannerInfo {
  transport: ScannerTransport
  label: string
  detail?: string
}

export interface BarcodeScanner {
  info: ScannerInfo
  start(onScan: (barcode: string) => void): Promise<void>
  stop(): void
}

// ---------------------------------------------------------------------------
// Transport support detection
// ---------------------------------------------------------------------------

export function supportsWebSerial(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

export function supportsWebBluetooth(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

// HID keyboard always works — it's just a keypress listener.
export function supportsHidKeyboard(): boolean {
  return typeof window !== 'undefined'
}

// ---------------------------------------------------------------------------
// 1. HID keyboard scanner
//    Detects rapid key sequences ending in Enter — characteristic of
//    barcode scanners that type the code faster than a human can.
// ---------------------------------------------------------------------------

const MIN_SCANNER_SPEED_CHARS_PER_SEC = 15
const MAX_GAP_BETWEEN_KEYS_MS = 80

export class HidKeyboardScanner implements BarcodeScanner {
  info: ScannerInfo = {
    transport: 'hid',
    label: 'USB / Type-C scanner (keyboard mode)',
    detail: 'Works with most plug-in barcode scanners — no setup needed.',
  }

  private buffer = ''
  private lastKeyTime = 0
  private listener: ((e: KeyboardEvent) => void) | null = null
  private onScan: ((barcode: string) => void) | null = null

  async start(onScan: (barcode: string) => void): Promise<void> {
    this.onScan = onScan
    this.listener = (e: KeyboardEvent) => this.handleKey(e)
    window.addEventListener('keydown', this.listener, true)
  }

  stop(): void {
    if (this.listener) {
      window.removeEventListener('keydown', this.listener, true)
      this.listener = null
    }
    this.buffer = ''
    this.onScan = null
  }

  private handleKey(e: KeyboardEvent) {
    const now = Date.now()
    const gap = now - this.lastKeyTime
    this.lastKeyTime = now

    // If the gap since the last keypress is large, start a fresh buffer
    // (a human is typing, or a new scan began).
    if (gap > MAX_GAP_BETWEEN_KEYS_MS) {
      this.buffer = ''
    }

    if (e.key === 'Enter') {
      if (this.buffer.length >= 4) {
        // Verify the speed was scanner-like.
        const elapsed = Math.max(1, now - (this.lastKeyTime - gap * this.buffer.length))
        const speed = (this.buffer.length / elapsed) * 1000
        if (speed >= MIN_SCANNER_SPEED_CHARS_PER_SEC || this.buffer.length >= 8) {
          e.preventDefault()
          const code = this.buffer
          this.buffer = ''
          this.onScan?.(code)
          return
        }
      }
      this.buffer = ''
      return
    }

    if (e.key.length === 1) {
      this.buffer += e.key
    }
  }
}

// ---------------------------------------------------------------------------
// 2. WebSerial scanner
//    Opens a serial port (typically via a USB-to-serial adapter or a
//    scanner that exposes a serial interface) and reads line-by-line.
// ---------------------------------------------------------------------------

export class WebSerialScanner implements BarcodeScanner {
  info: ScannerInfo = {
    transport: 'webserial',
    label: 'USB / Type-C scanner (serial mode)',
    detail: 'For scanners that output over a serial port. Chrome or Edge only.',
  }

  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private active = false

  async start(onScan: (barcode: string) => void): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error('WebSerial is not supported in this browser. Use Chrome or Edge.')
    }
    // Request a port — the browser shows the native device picker.
    this.port = await navigator.serial.requestPort()
    await this.port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' })
    this.active = true

    const decoder = new TextDecoder()
    let line = ''
    // Read loop — runs until stop() is called or the port closes.
    while (this.port.readable && this.active) {
      this.reader = this.port.readable.getReader()
      try {
        while (this.active) {
          const { done, value } = await this.reader.read()
          if (done) break
          if (value) {
            line += decoder.decode(value, { stream: true })
            // Most scanners terminate with \r or \r\n.
            let nl: number
            while ((nl = line.search(/[\r\n]/)) !== -1) {
              const code = line.slice(0, nl).trim()
              line = line.slice(nl + 1)
              if (code.length > 0) onScan(code)
            }
          }
        }
      } finally {
        this.reader.releaseLock()
      }
    }
  }

  async stop(): Promise<void> {
    this.active = false
    try {
      if (this.reader) await this.reader.cancel().catch(() => {})
    } catch {
      // ignore
    }
    try {
      if (this.port) await this.port.close().catch(() => {})
    } catch {
      // ignore
    }
    this.reader = null
    this.port = null
  }
}

// ---------------------------------------------------------------------------
// 3. Web Bluetooth scanner
//    Connects to a BLE barcode scanner that exposes a serial-like service.
//    Many BLE scanners use the Nordic UART Service (NUS).
// ---------------------------------------------------------------------------

// Nordic UART Service — common for BLE serial devices.
const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e' // write
const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e' // notify

export class WebBluetoothScanner implements BarcodeScanner {
  info: ScannerInfo = {
    transport: 'web-bluetooth',
    label: 'Bluetooth scanner',
    detail: 'For wireless BLE barcode scanners. Chrome or Edge only.',
  }

  private device: BluetoothDevice | null = null
  private characteristic: BluetoothCharacteristic | null = null
  private active = false

  async start(onScan: (barcode: string) => void): Promise<void> {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome or Edge.')
    }
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [NUS_SERVICE] }],
      optionalServices: [NUS_SERVICE],
    })
    if (!this.device.gatt) throw new Error('Selected device has no GATT server.')

    this.active = true
    this.device.addEventListener('gattserverdisconnected', () => {
      this.active = false
    })

    const server = await this.device.gatt.connect()
    const service = await server.getPrimaryService(NUS_SERVICE)
    this.characteristic = await service.getCharacteristic(NUS_TX)
    await this.characteristic.startNotifications()
    const decoder = new TextDecoder()
    let line = ''
    this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const target = event.target as BluetoothCharacteristic
      if (!target.value) return
      line += decoder.decode(target.value)
      let nl: number
      while ((nl = line.search(/[\r\n]/)) !== -1) {
        const code = line.slice(0, nl).trim()
        line = line.slice(nl + 1)
        if (code.length > 0) onScan(code)
      }
    })
  }

  async stop(): Promise<void> {
    this.active = false
    try {
      if (this.characteristic) await this.characteristic.stopNotifications().catch(() => {})
    } catch {
      // ignore
    }
    try {
      if (this.device && this.device.gatt?.connected) {
        this.device.gatt.disconnect()
      }
    } catch {
      // ignore
    }
    this.characteristic = null
    this.device = null
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScanner(transport: ScannerTransport): BarcodeScanner {
  switch (transport) {
    case 'hid':
      return new HidKeyboardScanner()
    case 'webserial':
      return new WebSerialScanner()
    case 'web-bluetooth':
      return new WebBluetoothScanner()
  }
}
