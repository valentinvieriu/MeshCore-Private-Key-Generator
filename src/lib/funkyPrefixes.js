import { bytesToHex, isReservedPrefix, normalizeHex } from './crypto'

const RAW_FUNKY_PREFIXES = [
  '07', '0ace', '0badc0de', '0dd', '0ddf00d', '0defaced', '0ff1ce',
  '1ace', '1badb002', '1ced', '1ce5', '1cefac', '1dea', '1eed', '1face',
  'ab1e', 'ac1d', 'aced', 'add1c7ed',
  'baadf00d', 'bad', 'badc0de', 'bada55', 'babe', 'ba5ed',
  'bead', 'bead5', 'beaded', 'beadface', 'beef', 'beefed', 'beefcafe', 'bed', 'bedface', 'b01dfade',
  'cab', 'cabbed', 'cafe', 'cafed00d', 'cafebabe', 'ca11ed', 'ca5cade', 'c0de', 'c0ffee', 'c001cafe', 'cade',
  'dead', 'deadbeef', 'deaf', 'decaf', 'decafbad', 'decade', 'deface', 'defaced', 'def1aced',
  'fab', 'face', 'facade', 'fade', 'faded', 'f00d', 'f0e', 'fee1', 'feed', 'feedface', 'fee1dead', 'f1a7', 'f1e5', 'fed',
  '5afe', '5ca1d', '5eed', '5eedc0de',
]

export const FUNKY_PREFIXES = Array.from(new Set(
  RAW_FUNKY_PREFIXES
    .map((value) => normalizeHex(value))
    .filter((value) => value.length >= 1 && value.length <= 8 && !isReservedPrefix(value)),
))

function randomIndex(limit) {
  if (limit <= 1) return 0
  const values = crypto.getRandomValues(new Uint32Array(1))
  return values[0] % limit
}

function shufflePrefixes(prefixes) {
  const out = [...prefixes]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function pickRandomFunkyPrefixes(count, options = {}) {
  const exclude = Array.isArray(options.exclude) ? options.exclude : [options.exclude]
  const excluded = new Set(exclude.filter(Boolean).map((value) => normalizeHex(value)))
  return shufflePrefixes(FUNKY_PREFIXES.filter((prefix) => !excluded.has(prefix))).slice(0, count)
}

export function createPreviewPublicKeyHex(prefixHex) {
  const prefix = normalizeHex(prefixHex)
  const tailLength = Math.max(0, 64 - prefix.length)
  const tail = bytesToHex(crypto.getRandomValues(new Uint8Array(Math.ceil(tailLength / 2)))).slice(0, tailLength)
  return `${prefix}${tail}`
}
