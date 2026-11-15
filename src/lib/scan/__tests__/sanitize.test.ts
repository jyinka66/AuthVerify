import { describe, expect, it } from 'bun:test'
import { sanitizeText, isValidEmail, isValidUrl } from '../sanitize'

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")')
  })

  it('strips nested HTML tags', () => {
    expect(sanitizeText('<div><p>Hello</p></div>')).toBe('Hello')
  })

  it('removes control characters but keeps newlines', () => {
    expect(sanitizeText('Hello\x00World\nNew')).toBe('HelloWorld\nNew')
  })

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
  })

  it('truncates to the max length for the field type', () => {
    const long = 'a'.repeat(200)
    expect(sanitizeText(long, 'brand').length).toBe(100)
  })

  it('truncates to default length when no field type', () => {
    const long = 'a'.repeat(1000)
    expect(sanitizeText(long).length).toBe(500)
  })

  it('handles undefined input', () => {
    expect(sanitizeText(undefined)).toBe('')
  })

  it('handles null input', () => {
    expect(sanitizeText(null)).toBe('')
  })

  it('preserves valid text', () => {
    expect(sanitizeText('Panadol Extra')).toBe('Panadol Extra')
  })

  it('preserves special characters that are not HTML', () => {
    expect(sanitizeText('Coca-Cola 500ml (12pk)')).toBe('Coca-Cola 500ml (12pk)')
  })
})

describe('isValidEmail', () => {
  it('accepts a valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it('rejects an email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects an email without domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects an email without TLD', () => {
    expect(isValidEmail('user@example')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})

describe('isValidUrl', () => {
  it('accepts a valid https URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true)
  })

  it('accepts a valid http URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true)
  })

  it('rejects a non-URL string', () => {
    expect(isValidUrl('not a url')).toBe(false)
  })

  it('rejects a javascript: URL', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidUrl('')).toBe(false)
  })
})
