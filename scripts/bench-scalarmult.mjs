import sodium from 'libsodium-wrappers-sumo'
import { webcrypto } from 'node:crypto'

await sodium.ready

const rng = webcrypto.getRandomValues.bind(webcrypto)

const pathCurrent = (seed) => sodium.crypto_sign_seed_keypair(seed).publicKey

const pathDirect = (seed) => {
  const az = sodium.crypto_hash_sha512(seed)
  az[0] &= 248
  az[31] &= 127
  az[31] |= 64
  return sodium.crypto_scalarmult_ed25519_base_noclamp(az.subarray(0, 32))
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// Correctness check: both paths must produce identical public keys.
const correctnessSeeds = 64
for (let i = 0; i < correctnessSeeds; i++) {
  const seed = new Uint8Array(32)
  rng(seed)
  const a = pathCurrent(seed)
  const b = pathDirect(seed)
  if (!bytesEqual(a, b)) {
    console.error(`Mismatch at iteration ${i}`)
    console.error(`  seed:    ${Buffer.from(seed).toString('hex')}`)
    console.error(`  current: ${Buffer.from(a).toString('hex')}`)
    console.error(`  direct:  ${Buffer.from(b).toString('hex')}`)
    process.exit(1)
  }
}
console.log(`Correctness: ${correctnessSeeds}/${correctnessSeeds} seeds match`)

function benchPath(label, fn, durationMs) {
  const seed = new Uint8Array(32)
  for (let i = 0; i < 2000; i++) { rng(seed); fn(seed) }

  let attempts = 0
  const start = performance.now()
  while (performance.now() - start < durationMs) {
    for (let i = 0; i < 512; i++) {
      rng(seed)
      fn(seed)
      attempts++
    }
  }
  const elapsed = performance.now() - start
  const rate = attempts / (elapsed / 1000)
  console.log(`${label.padEnd(50)} ${Math.round(rate).toLocaleString().padStart(10)} att/s  (${attempts.toLocaleString()} in ${elapsed.toFixed(0)}ms)`)
  return rate
}

const DURATION_MS = Number(process.env.BENCH_MS) || 5000
const RUNS = Number(process.env.BENCH_RUNS) || 3

console.log(`\nRunning ${RUNS} passes of ${DURATION_MS}ms each\n`)

const currentRates = []
const directRates = []

for (let run = 1; run <= RUNS; run++) {
  console.log(`--- Pass ${run}/${RUNS} ---`)
  currentRates.push(benchPath('current (crypto_sign_seed_keypair)', pathCurrent, DURATION_MS))
  directRates.push(benchPath('direct (sha512 + scalarmult_base_noclamp)', pathDirect, DURATION_MS))
  console.log('')
}

const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length
const min = (arr) => Math.min(...arr)
const max = (arr) => Math.max(...arr)

const currentAvg = avg(currentRates)
const directAvg = avg(directRates)
const delta = ((directAvg - currentAvg) / currentAvg) * 100

console.log('=== Summary ===')
console.log(`current avg: ${Math.round(currentAvg).toLocaleString()} att/s  (min ${Math.round(min(currentRates)).toLocaleString()}, max ${Math.round(max(currentRates)).toLocaleString()})`)
console.log(`direct  avg: ${Math.round(directAvg).toLocaleString()} att/s  (min ${Math.round(min(directRates)).toLocaleString()}, max ${Math.round(max(directRates)).toLocaleString()})`)
console.log(`delta:       ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`)
