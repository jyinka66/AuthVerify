/**
 * Input sanitization for user-submitted text.
 *
 * Strips HTML tags, control characters, and limits length to prevent
 * XSS attacks in stored data (community reports, manufacturer profiles,
 * feedback notes). Applied server-side on all text inputs before
 * storage or display.
 */

const MAX_TEXT_LENGTH: Record<string, number> = {
  brand: 100,
  productName: 200,
  packSize: 50,
  details: 1000,
  notes: 1000,
  companyName: 200,
  contactEmail: 200,
  phone: 30,
  regulatoryLicenseNumber: 100,
  website: 300,
  description: 2000,
  default: 500,
}

/**
 * Sanitize a text input:
 * - Strips HTML tags (prevents stored XSS)
 * - Removes control characters (except newlines and tabs)
 * - Trims whitespace
 * - Truncates to the max length for the field type
 */
export function sanitizeText(input: string | undefined | null, fieldType?: keyof typeof MAX_TEXT_LENGTH): string {
  if (!input) return ''
  const max = (fieldType && MAX_TEXT_LENGTH[fieldType]) || MAX_TEXT_LENGTH.default

  let text = String(input)
  // Strip HTML tags.
  text = text.replace(/<[^>]*>/g, '')
  // Remove control characters except \n, \r, \t.
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  // Trim and truncate.
  text = text.trim().slice(0, max)
  return text
}

/** Validate an email format (basic check — not RFC-compliant but catches obvious junk). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200
}

/** Validate a URL format (must start with http:// or https://). */
export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
