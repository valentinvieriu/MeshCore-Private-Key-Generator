let nextJobId = 1

function buildWorkerScript() {
  return `
    let activeJobs = new Set();

    function bytesToHex(bytes) {
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    function base64UrlToBytes(value) {
      const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
      const decoded = atob(padded);
      const out = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) out[i] = decoded.charCodeAt(i);
      return out;
    }
    function clampMeshCorePrivateKey(bytes64) {
      const out = new Uint8Array(bytes64);
      out[0] &= 248;
      out[31] &= 63;
      out[31] |= 64;
      return out;
    }
    function hexToBytes(hex) {
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    }

    async function run(jobId, targetHex, batchSize) {
      const prefix = hexToBytes(targetHex);
      while (activeJobs.has(jobId)) {
        const batchStart = performance.now();
        let attempts = 0;
        for (let i = 0; i < batchSize && activeJobs.has(jobId); i++) {
          // Hot loop: only generateKey + raw public export + byte comparison
          const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
          const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
          attempts++;

          // Reserved prefix check in bytes (no hex conversion)
          if (rawPub[0] === 0x00 || rawPub[0] === 0xff) continue;

          // Prefix comparison directly on bytes
          let match = true;
          for (let j = 0; j < prefix.length; j++) {
            if (rawPub[j] !== prefix[j]) { match = false; break; }
          }
          if (!match) continue;

          // Match found — now do the expensive exports on the SAME keypair
          const [privateJwk, pkcs8Buffer] = await Promise.all([
            crypto.subtle.exportKey('jwk', keyPair.privateKey),
            crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
          ]);
          if (!privateJwk.d) throw new Error('Private JWK export missing seed');
          const seed = base64UrlToBytes(privateJwk.d);
          const digest = new Uint8Array(await crypto.subtle.digest('SHA-512', seed));
          const meshPriv = clampMeshCorePrivateKey(digest);

          activeJobs.delete(jobId);
          postMessage({
            type: 'found', jobId,
            attemptsDelta: attempts,
            elapsedMs: performance.now() - batchStart,
            seedHex: bytesToHex(seed),
            rawPublicKeyHex: bytesToHex(rawPub),
            meshcorePrivateHex: bytesToHex(meshPriv),
            pkcs8Hex: bytesToHex(new Uint8Array(pkcs8Buffer)),
          });
          return;
        }
        postMessage({ type: 'progress', jobId, attemptsDelta: attempts, elapsedMs: performance.now() - batchStart });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      postMessage({ type: 'stopped', jobId });
    }

    self.onmessage = (event) => {
      const msg = event.data || {};
      if (msg.type === 'start') {
        activeJobs.add(msg.jobId);
        run(msg.jobId, msg.targetHex, msg.batchSize).catch((error) => {
          activeJobs.delete(msg.jobId);
          postMessage({ type: 'error', jobId: msg.jobId, message: error.message || String(error) });
        });
      } else if (msg.type === 'stop') {
        activeJobs.delete(msg.jobId);
      }
    };
  `
}

export class WorkerPool {
  constructor() {
    this.workers = []
    this.workerCount = 0
    this.scriptUrl = null
    this.activeJobId = null
  }

  async init(workerCount) {
    if (this.workers.length === workerCount) return
    this.destroy()
    this.workerCount = workerCount
    const source = buildWorkerScript()
    const blob = new Blob([source], { type: 'application/javascript' })
    this.scriptUrl = URL.createObjectURL(blob)
    for (let i = 0; i < workerCount; i++) this.workers.push(new Worker(this.scriptUrl))
  }

  destroy() {
    for (const worker of this.workers) worker.terminate()
    this.workers = []
    if (this.scriptUrl) URL.revokeObjectURL(this.scriptUrl)
    this.scriptUrl = null
    this.activeJobId = null
  }

  stop() {
    if (!this.activeJobId) return
    for (const worker of this.workers) {
      try { worker.postMessage({ type: 'stop', jobId: this.activeJobId }) } catch { /* ignore */ }
    }
    this.activeJobId = null
  }

  async runSearch({ targetHex, batchSize, onProgress, onFound }) {
    const jobId = nextJobId++
    this.activeJobId = jobId
    return new Promise((resolve, reject) => {
      let resolved = false
      let stoppedCount = 0
      const handlers = new Map()
      const cleanup = () => {
        for (const [worker, handler] of handlers) {
          worker.removeEventListener('message', handler)
          worker.removeEventListener('error', handler.__errorHandler)
        }
      }
      const finish = (fn) => {
        if (resolved) return
        resolved = true
        cleanup()
        this.activeJobId = null
        fn()
      }

      this.workers.forEach((worker, index) => {
        const handler = (event) => {
          const msg = event.data || {}
          if (msg.jobId !== jobId) return
          if (msg.type === 'progress') {
            onProgress?.(msg.attemptsDelta || 0, msg.elapsedMs || 0)
          } else if (msg.type === 'found') {
            onFound?.(msg)
            for (const w of this.workers) {
              try { w.postMessage({ type: 'stop', jobId }) } catch { /* ignore */ }
            }
            finish(() => resolve(msg))
          } else if (msg.type === 'error') {
            finish(() => reject(new Error(msg.message || 'Worker failed')))
          } else if (msg.type === 'stopped') {
            stoppedCount++
            if (stoppedCount >= this.workers.length) {
              finish(() => resolve(null))
            }
          }
        }
        const errorHandler = (err) => finish(() => reject(err instanceof Error ? err : new Error('Worker error')))
        handler.__errorHandler = errorHandler
        handlers.set(worker, handler)
        worker.addEventListener('message', handler)
        worker.addEventListener('error', errorHandler)
        worker.postMessage({ type: 'start', jobId, targetHex, batchSize, workerIndex: index })
      })
    })
  }
}
