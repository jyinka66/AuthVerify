/**
 * In-memory rate limiter with TTL windows.
 *
 * Production note: swap this for Redis/Upstash when scaling across multiple
 * instances — in-memory limits are per-process and won't share state across
 * replicas. For single-instance dev and small-scale production, this is fine.
 *
 * Two dimensions are tracked:
 * - per-device (the device fingerprint from the client) — primary limit
 * - per-IP (fallback when no device fingerprint is provided) — abuse protection
 *
 * A global daily AI budget circuit breaker trips when the total number of
 * AI-heavy calls (quick + deep scans) exceeds a daily cap, protecting against
 * cost runaway regardless of per-user limits.
 */

interface RateBucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateBucket>()
const DAILY_AI_BUDGET = 2000 // total AI calls per day across all users
let dailyAiCount = 0
let dailyResetAt = nextMidnight()

function nextMidnight(): number {
  const t = new Date()
  t.setUTCHours(24, 0, 0, 0)
  return t.getTime()
}

function getBucket(key: string, windowMs: number): RateBucket {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  return bucket
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window. */
  max: number
  /** Window duration in milliseconds. */
  windowMs: number
  /** Label for the rate-limit key namespace (e.g., 'quick', 'deep'). */
  namespace: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  /** When the global AI budget is exhausted, this is true with a different message. */
  budgetExhausted: boolean
}

/**
 * Check a rate limit. The `identifier` should be the device fingerprint when
 * available, falling back to the IP address. Both per-identifier and per-IP
 * limits are enforced — the stricter one wins.
 */
export function checkRateLimit(
  identifier: string,
  ip: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()

  // Reset the daily AI budget at UTC midnight.
  if (now >= dailyResetAt) {
    dailyAiCount = 0
    dailyResetAt = nextMidnight()
  }

  // Global daily budget circuit breaker.
  if (dailyAiCount >= DAILY_AI_BUDGET) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: dailyResetAt,
      budgetExhausted: true,
    }
  }

  // Per-identifier limit (device fingerprint or IP).
  const idKey = `${config.namespace}:id:${identifier}`
  const idBucket = getBucket(idKey, config.windowMs)

  // Per-IP limit (catches cases where one IP rotates device fingerprints).
  const ipKey = `${config.namespace}:ip:${ip}`
  const ipBucket = getBucket(ipKey, config.windowMs * 4) // IP window is 4x longer to allow shared networks

  const idAllowed = idBucket.count < config.max
  const ipAllowed = ipBucket.count < config.max * 3 // IP allows 3x more (shared networks, offices)

  if (!idAllowed || !ipAllowed) {
    const resetAt = Math.max(idBucket.resetAt, ipBucket.resetAt)
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      budgetExhausted: false,
    }
  }

  // Consume both buckets.
  idBucket.count++
  ipBucket.count++
  dailyAiCount++

  return {
    allowed: true,
    remaining: Math.max(0, config.max - idBucket.count),
    resetAt: idBucket.resetAt,
    budgetExhausted: false,
  }
}

/** Get the client IP from a Next.js request, accounting for proxies. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/** Build standard rate-limit response headers for the client. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'X-RateLimit-Budget-Exhausted': String(result.budgetExhausted),
  }
}

// Default limits per scan mode.
export const LIMITS = {
  quick: { max: 20, windowMs: 60 * 60 * 1000, namespace: 'quick' }, // 20/hour
  deep: { max: 5, windowMs: 60 * 60 * 1000, namespace: 'deep' }, // 5/hour (expensive)
  report: { max: 10, windowMs: 60 * 60 * 1000, namespace: 'report' }, // 10/hour
} satisfies Record<string, RateLimitConfig>
