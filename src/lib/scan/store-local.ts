import type { ScanRecord } from './types'

/**
 * Client-side localStorage persistence for scan history.
 * Used as the primary store when Supabase is not configured, and as an
 * instant-display cache even when Supabase IS configured.
 */

const HISTORY_KEY = 'authverify_scan_history'
const MAX_LOCAL = 50

export function isUsingLocalStore(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL
}

export function listLocalScans(): ScanRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ScanRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLocalScan(scan: ScanRecord): void {
  if (typeof window === 'undefined') return
  try {
    const existing = listLocalScans()
    const next = [scan, ...existing].slice(0, MAX_LOCAL)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch (err) {
    console.error('[local-store] save failed:', err)
  }
}

export function deleteLocalScan(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const next = listLocalScans().filter((s) => s.id !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch (err) {
    console.error('[local-store] delete failed:', err)
  }
}

export function clearLocalScans(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(HISTORY_KEY)
}
