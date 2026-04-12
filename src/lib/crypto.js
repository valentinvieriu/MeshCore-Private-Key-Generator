export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function normalizeHex(value) {
  return (value || '').toLowerCase().replace(/^0x/, '').replace(/[^0-9a-f]/g, '')
}

export function hexToBytes(hex) {
  const clean = normalizeHex(hex)
  if (clean.length % 2 !== 0) throw new Error('Hex length must be even.')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function base64UrlEncode(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const decoded = atob(padded)
  const out = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) out[i] = decoded.charCodeAt(i)
  return out
}

export function clampMeshCorePrivateKey(bytes64) {
  const out = new Uint8Array(bytes64)
  out[0] &= 248
  out[31] &= 63
  out[31] |= 64
  return out
}

export function prefixMatches(pub, prefix) {
  for (let i = 0; i < prefix.length; i++) {
    if (pub[i] !== prefix[i]) return false
  }
  return true
}

export function isReservedPrefix(prefixHex) {
  const clean = normalizeHex(prefixHex)
  return clean.length >= 2 && (clean.startsWith('00') || clean.startsWith('ff'))
}

export function formatNumber(num) {
  return new Intl.NumberFormat().format(num)
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}

export function expectedAttemptsForHexLength(hexLength) {
  return Math.pow(16, hexLength)
}

export async function createMeshCoreCandidateFromKeyPair(keyPair) {
  const [privateJwk, rawPubBuffer, pkcs8Buffer] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
    crypto.subtle.exportKey('raw', keyPair.publicKey),
    crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  ])
  if (!privateJwk.d) throw new Error('Private JWK export missing seed')
  const seed = base64UrlToBytes(privateJwk.d)
  if (seed.length !== 32) throw new Error(`Expected 32-byte seed, got ${seed.length}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-512', seed))
  const meshPriv = clampMeshCorePrivateKey(digest)
  const rawPublic = new Uint8Array(rawPubBuffer)
  return {
    seedHex: bytesToHex(seed),
    rawPublicKeyHex: bytesToHex(rawPublic),
    meshcorePrivateHex: bytesToHex(meshPriv),
    pkcs8Hex: bytesToHex(new Uint8Array(pkcs8Buffer)),
  }
}

export async function validateCandidate(candidate) {
  if (candidate.rawPublicKeyHex.length !== 64) throw new Error('Raw public key must be 64 hex chars')
  if (candidate.seedHex.length !== 64) throw new Error('Seed must be 64 hex chars')
  if (candidate.meshcorePrivateHex.length !== 128) throw new Error('MeshCore private key must be 128 hex chars')
  if (isReservedPrefix(candidate.rawPublicKeyHex)) throw new Error('Reserved public key prefix generated')
  const meshPriv = hexToBytes(candidate.meshcorePrivateHex)
  if ((meshPriv[0] & 7) !== 0) throw new Error('MeshCore private key clamp failed at byte 0')
  if ((meshPriv[31] & 0x80) !== 0) throw new Error('MeshCore private key clamp failed at byte 31 top bit')
  if ((meshPriv[31] & 0x40) === 0) throw new Error('MeshCore private key clamp failed at byte 31 high bit')

  const message = crypto.getRandomValues(new Uint8Array(32))
  const pkcs8Bytes = hexToBytes(candidate.pkcs8Hex)
  const publicBytes = hexToBytes(candidate.rawPublicKeyHex)
  const [importedPrivate, importedPublic] = await Promise.all([
    crypto.subtle.importKey('pkcs8', pkcs8Bytes, { name: 'Ed25519' }, false, ['sign']),
    crypto.subtle.importKey('raw', publicBytes, { name: 'Ed25519' }, false, ['verify']),
  ])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, importedPrivate, message))
  const ok = await crypto.subtle.verify({ name: 'Ed25519' }, importedPublic, sig, message)
  if (!ok) throw new Error('Sign/verify validation failed')

  return 'Validated: raw public key length looks correct, MeshCore private key is 128 hex chars with proper clamp bits, reserved prefixes are blocked, and sign/verify passed.'
}
