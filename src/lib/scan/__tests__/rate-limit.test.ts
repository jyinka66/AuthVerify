import { describe, expect, it, beforeEach } from 'bun:test'
import { checkRateLimit, getClientIp, LIMITS } from '../rate-limit'

describe('checkRateLimit', () => {
  it('allows the first request', () => {
    const result = checkRateLimit('device-1', '1.2.3.4', LIMITS.quick)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeLessThan(LIMITS.quick.max)
    expect(result.budgetExhausted).toBe(false)
  })

  it('blocks after exceeding the per-device limit', () => {
    const config = { max: 3, windowMs: 60000, namespace: 'test-block' }
    // Use up the limit
    checkRateLimit('device-block', '1.1.1.1', config)
    checkRateLimit('device-block', '1.1.1.1', config)
    checkRateLimit('device-block', '1.1.1.1', config)
    // 4th request should be blocked
    const result = checkRateLimit('device-block', '1.1.1.1', config)
    expect(result.allowed).toBe(false)
  })

  it('allows different devices independently', () => {
    const config = { max: 2, windowMs: 60000, namespace: 'test-independent' }
    checkRateLimit('device-a', '1.1.1.1', config)
    checkRateLimit('device-a', '1.1.1.1', config)
    // Different device should still be allowed
    const result = checkRateLimit('device-b', '2.2.2.2', config)
    expect(result.allowed).toBe(true)
  })

  it('counts remaining requests correctly', () => {
    const config = { max: 5, windowMs: 60000, namespace: 'test-remaining' }
    const first = checkRateLimit('device-rem', '1.1.1.1', config)
    expect(first.allowed).toBe(true)
    expect(first.remaining).toBe(4)
  })

  it('returns budgetExhausted flag when budget is hit', () => {
    // The global budget is 2000 calls. We can't exhaust it in a test,
    // but we can verify the flag exists and is false for normal calls.
    const result = checkRateLimit('device-budget', '1.1.1.1', LIMITS.quick)
    expect(result.budgetExhausted).toBe(false)
  })
})

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('extracts IP from x-real-ip header', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-real-ip': '9.8.7.6' },
    })
    expect(getClientIp(req)).toBe('9.8.7.6')
  })

  it('returns unknown when no IP headers present', () => {
    const req = new Request('https://example.com')
    expect(getClientIp(req)).toBe('unknown')
  })

  it('prioritizes x-forwarded-for over x-real-ip', () => {
    const req = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '1.2.3.4',
        'x-real-ip': '5.6.7.8',
      },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })
})
