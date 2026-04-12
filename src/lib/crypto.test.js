import { describe, test, expect } from 'vitest'
import {
  bytesToHex, normalizeHex, hexToBytes, base64UrlToBytes, base64UrlEncode,
  clampMeshCorePrivateKey, prefixMatches, isReservedPrefix,
  createMeshCoreCandidateFromKeyPair, validateCandidate,
} from './crypto'
import { WorkerPool } from './workerPool'

describe('hex utilities', () => {
  test('normalizeHex strips non-hex and 0x', () => {
    expect(normalizeHex('0x11-ab')).toBe('11ab')
  })

  test('bytesToHex and hexToBytes round-trip', () => {
    const hex = 'deadbeef'
    expect(bytesToHex(hexToBytes(hex))).toBe(hex)
  })

  test('hexToBytes throws on odd length', () => {
    expect(() => hexToBytes('abc')).toThrow('even')
  })
})

describe('base64url', () => {
  test('decodes 32 bytes', () => {
    const bytes = base64UrlToBytes('AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8')
    expect(bytes.length).toBe(32)
  })

  test('encode/decode round-trip', () => {
    const original = crypto.getRandomValues(new Uint8Array(32))
    const encoded = base64UrlEncode(original)
    const decoded = base64UrlToBytes(encoded)
    expect(bytesToHex(decoded)).toBe(bytesToHex(original))
  })
})

describe('MeshCore clamping', () => {
  test('clears low bits of byte 0 and sets/clears bits of byte 31', () => {
    const input = new Uint8Array(64).fill(255)
    const out = clampMeshCorePrivateKey(input)
    expect(out[0] & 7).toBe(0)
    expect(out[31] & 0x80).toBe(0)
    expect(out[31] & 0x40).toBe(64)
  })
})

describe('prefix matching', () => {
  test('matches correct prefixes', () => {
    const pub = hexToBytes('11223344')
    expect(prefixMatches(pub, hexToBytes('11'))).toBe(true)
    expect(prefixMatches(pub, hexToBytes('1122'))).toBe(true)
  })

  test('rejects wrong prefix', () => {
    const pub = hexToBytes('11223344')
    expect(prefixMatches(pub, hexToBytes('ff'))).toBe(false)
  })
})

describe('reserved prefix check', () => {
  test('catches 00 and ff', () => {
    expect(isReservedPrefix('00')).toBe(true)
    expect(isReservedPrefix('ff')).toBe(true)
  })

  test('allows normal prefixes', () => {
    expect(isReservedPrefix('11')).toBe(false)
  })
})

describe('candidate generation', () => {
  test('yields correct MeshCore sizes', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
    const candidate = await createMeshCoreCandidateFromKeyPair(keyPair)
    expect(candidate.seedHex.length).toBe(64)
    expect(candidate.rawPublicKeyHex.length).toBe(64)
    expect(candidate.meshcorePrivateHex.length).toBe(128)
  })

  test('passes validation (clamp bits + sign/verify)', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
    const candidate = await createMeshCoreCandidateFromKeyPair(keyPair)
    const msg = await validateCandidate(candidate)
    expect(msg).toContain('Validated')
  })
})

describe('worker pool', () => {
  test.skipIf(typeof Worker === 'undefined')('initializes and reuses workers', async () => {
    const pool = new WorkerPool()
    await pool.init(2)
    expect(pool.workers.length).toBe(2)
    await pool.init(2)
    expect(pool.workers.length).toBe(2)
    pool.destroy()
  })
})
