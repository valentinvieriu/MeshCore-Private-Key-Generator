import sodium from 'libsodium-wrappers'

const activeJobs = new Set()

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const initPromise = sodium.ready

async function run(jobId, targetHex, batchSize) {
  await initPromise

  // Parse prefix: full bytes + optional trailing nibble
  const fullBytes = Math.floor(targetHex.length / 2)
  const hasHalfByte = targetHex.length % 2 === 1
  const prefixBytes = new Uint8Array(fullBytes + (hasHalfByte ? 1 : 0))
  for (let i = 0; i < fullBytes; i++) {
    prefixBytes[i] = Number.parseInt(targetHex.slice(i * 2, i * 2 + 2), 16)
  }
  if (hasHalfByte) {
    prefixBytes[fullBytes] = Number.parseInt(targetHex[targetHex.length - 1], 16) << 4
  }

  const seed = new Uint8Array(32)
  let pendingAttempts = 0
  let lastPostTime = performance.now()
  let lastYieldTime = performance.now()

  while (activeJobs.has(jobId)) {
    for (let i = 0; i < batchSize && activeJobs.has(jobId); i++) {
      // Hot loop: all synchronous, zero awaits
      crypto.getRandomValues(seed)
      const { publicKey } = sodium.crypto_sign_seed_keypair(seed)
      pendingAttempts++

      // Reserved prefix check
      if (publicKey[0] === 0x00 || publicKey[0] === 0xff) continue

      // Full-byte prefix comparison
      let match = true
      for (let j = 0; j < fullBytes; j++) {
        if (publicKey[j] !== prefixBytes[j]) { match = false; break }
      }
      // Trailing nibble comparison (high nibble only)
      if (match && hasHalfByte) {
        if ((publicKey[fullBytes] & 0xf0) !== prefixBytes[fullBytes]) match = false
      }
      if (!match) continue

      // Match found — post immediately so pool can stop other workers fast
      activeJobs.delete(jobId)
      postMessage({
        type: 'match', jobId,
        attemptsDelta: pendingAttempts,
        seedHex: bytesToHex(seed),
        rawPublicKeyHex: bytesToHex(publicKey),
      })
      return
    }

    const now = performance.now()
    if (now - lastPostTime >= 200) {
      postMessage({ type: 'progress', jobId, attemptsDelta: pendingAttempts })
      pendingAttempts = 0
      lastPostTime = now
    }
    // Yield to message queue for stop messages, but not every batch — time-budget it
    if (now - lastYieldTime >= 100) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      lastYieldTime = performance.now()
    }
  }

  if (pendingAttempts > 0) {
    postMessage({ type: 'progress', jobId, attemptsDelta: pendingAttempts })
  }
  postMessage({ type: 'stopped', jobId })
}

self.onmessage = (event) => {
  const msg = event.data || {}
  if (msg.type === 'start') {
    activeJobs.add(msg.jobId)
    run(msg.jobId, msg.targetHex, msg.batchSize).catch((error) => {
      activeJobs.delete(msg.jobId)
      postMessage({ type: 'error', jobId: msg.jobId, message: error.message || String(error) })
    })
  } else if (msg.type === 'stop') {
    activeJobs.delete(msg.jobId)
  }
}
