import { describe, expect, it } from 'bun:test'
import { extractJson } from '../json'

describe('extractJson', () => {
  it('parses a plain JSON object', () => {
    const result = extractJson('{"verdict":"likely_authentic","confidenceScore":90}')
    expect(result).toEqual({ verdict: 'likely_authentic', confidenceScore: 90 })
  })

  it('parses a JSON array', () => {
    const result = extractJson<{ items: number[] }>('{"items":[1,2,3]}')
    expect(result.items).toEqual([1, 2, 3])
  })

  it('strips markdown code fences', () => {
    const input = '```json\n{"verdict":"high_risk_counterfeit"}\n```'
    const result = extractJson(input)
    expect(result).toEqual({ verdict: 'high_risk_counterfeit' })
  })

  it('strips markdown fences without language tag', () => {
    const input = '```\n{"verdict":"inconclusive"}\n```'
    const result = extractJson(input)
    expect(result).toEqual({ verdict: 'inconclusive' })
  })

  it('extracts JSON from surrounding text', () => {
    const input = 'Here is the result: {"verdict":"likely_authentic","confidenceScore":85} Done.'
    const result = extractJson(input)
    expect(result).toEqual({ verdict: 'likely_authentic', confidenceScore: 85 })
  })

  it('handles JSON with nested objects', () => {
    const input = '{"flags":[{"kind":"red_flag","category":"hologram_missing"}]}'
    const result = extractJson(input)
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0].category).toBe('hologram_missing')
  })

  it('handles JSON with string values containing braces', () => {
    const input = '{"reasoning":"The logo {is} correct"}'
    const result = extractJson(input)
    expect(result.reasoning).toBe('The logo {is} correct')
  })

  it('throws on empty input', () => {
    expect(() => extractJson('')).toThrow()
  })

  it('throws on non-JSON text', () => {
    expect(() => extractJson('This is just text with no JSON')).toThrow()
  })

  it('handles whitespace-only input', () => {
    expect(() => extractJson('   ')).toThrow()
  })
})
