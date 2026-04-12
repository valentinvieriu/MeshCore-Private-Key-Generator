let nextJobId = 1

export class WorkerPool {
  constructor() {
    this.workers = []
    this.workerCount = 0
    this.activeJobId = null
  }

  async init(workerCount) {
    if (this.workers.length === workerCount) return
    this.destroy()
    this.workerCount = workerCount
    for (let i = 0; i < workerCount; i++) {
      this.workers.push(
        new Worker(new URL('./searchWorker.js', import.meta.url), { type: 'module' })
      )
    }
  }

  destroy() {
    for (const worker of this.workers) worker.terminate()
    this.workers = []
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
            onProgress?.(msg.attemptsDelta || 0)
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
