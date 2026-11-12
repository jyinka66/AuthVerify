/**
 * Client-side device fingerprint for anonymous scan history.
 * No PII is collected — only a stable random ID stored in localStorage.
 * When Supabase Auth is added (Phase 2), the user_id takes precedence
 * and this device_id becomes the fallback for anonymous users.
 */

const DEVICE_KEY = 'authverify_device_id'

/** Returns a stable device fingerprint, creating one if none exists. */
export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server'
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    // Generate a random fingerprint (not cryptographic, just unique enough).
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

/** Detects the user's rough region from browser locale / timezone. */
export function detectRegion(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  const lang = navigator.language || ''
  if (tz.includes('Africa') || /-(NG|GH|KE|UG|ZA|TZ|EG|MA)$/.test(lang)) {
    return tz.split('/').pop() || 'Africa'
  }
  return tz || lang || 'unknown'
}
