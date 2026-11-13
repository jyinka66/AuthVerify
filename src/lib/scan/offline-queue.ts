import type { ProductCategory, ScanMode } from './types'

/**
 * Offline scan queue. When the user scans a product while offline, the
 * request is stored here and automatically processed when connectivity
 * returns. The queue is backed by localStorage so it survives page reloads.
 *
 * The core VLM analysis requires connectivity (cloud AI), so "offline scan"
 * means: capture now, queue the request, process automatically when online.
 */

export interface QueuedScan {
  id: string
  mode: ScanMode
  category: ProductCategory | null
  image: string          // data URL of the captured photo
  deviceFingerprint: string
  region?: string
  queuedAt: string
  attempts: number
  status: 'pending' | 'processing' | 'done' | 'failed'
  result?: unknown       // the ScanRecord when done
  error?: string
}

const QUEUE_KEY = 'authverify_offline_queue'
const MAX_QUEUE = 20

export function getQueuedScans(): QueuedScan[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueuedScan[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQueue(scans: QueuedScan[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(scans.slice(0, MAX_QUEUE)))
  } catch (err) {
    console.error('[offline-queue] save failed:', err)
  }
}

export function queueScan(scan: Omit<QueuedScan, 'id' | 'queuedAt' | 'attempts' | 'status'>): QueuedScan {
  const queued: QueuedScan = {
    ...scan,
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  }
  const scans = getQueuedScans()
  // Remove any existing done/failed scans to make room.
  const active = scans.filter((s) => s.status === 'pending' || s.status === 'processing')
  saveQueue([queued, ...active])
  return queued
}

export function updateQueuedScan(id: string, updates: Partial<QueuedScan>): void {
  const scans = getQueuedScans()
  const idx = scans.findIndex((s) => s.id === id)
  if (idx === -1) return
  scans[idx] = { ...scans[idx], ...updates }
  saveQueue(scans)
}

export function removeQueuedScan(id: string): void {
  const scans = getQueuedScans().filter((s) => s.id !== id)
  saveQueue(scans)
}

export function clearCompletedQueuedScans(): void {
  const scans = getQueuedScans().filter((s) => s.status === 'pending' || s.status === 'processing')
  saveQueue(scans)
}

export function getPendingQueuedScans(): QueuedScan[] {
  return getQueuedScans().filter((s) => s.status === 'pending')
}

export function getQueuedCount(): number {
  return getPendingQueuedScans().length
}

/**
 * Register a background sync with the service worker (Chrome/Android only).
 * When the SW fires the 'sync' event, it reads the queue and processes it.
 * Falls back to the page-level online listener on browsers without Background Sync.
 */
export async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    if ('sync' in reg) {
      await (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('process-scan-queue')
    }
  } catch {
    // Background Sync not supported — the page-level online listener handles it.
  }
}
