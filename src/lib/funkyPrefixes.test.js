import { describe, expect, test } from 'vitest'
import { isReservedPrefix } from './crypto'
import { FUNKY_PREFIXES, pickRandomFunkyPrefixes, createPreviewPublicKeyHex } from './funkyPrefixes'

describe('funky prefix catalog', () => {
  test('stays large and unique', () => {
    expect(FUNKY_PREFIXES.length).toBeGreaterThanOrEqual(50)
    expect(new Set(FUNKY_PREFIXES).size).toBe(FUNKY_PREFIXES.length)
  })

  test('contains only valid non-reserved prefixes', () => {
    for (const prefix of FUNKY_PREFIXES) {
      expect(prefix).toMatch(/^[0-9a-f]{1,8}$/)
      expect(isReservedPrefix(prefix)).toBe(false)
    }
  })

  test('returns unique random suggestions', () => {
    const suggestions = pickRandomFunkyPrefixes(6)
    expect(suggestions).toHaveLength(6)
    expect(new Set(suggestions).size).toBe(6)
  })

  test('builds preview public keys from the chosen prefix', () => {
    const preview = createPreviewPublicKeyHex('beef')
    expect(preview.startsWith('beef')).toBe(true)
    expect(preview).toHaveLength(64)
  })
})
