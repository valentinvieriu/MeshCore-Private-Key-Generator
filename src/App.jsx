import { useState, useRef, useEffect, useCallback } from 'react'
import { bytesToHex, normalizeHex, isReservedPrefix, validateCandidate, createMeshCoreCandidateFromKeyPair } from './lib/crypto'
import { WorkerPool } from './lib/workerPool'
import SearchSettings from './components/SearchSettings'
import LiveStats from './components/LiveStats'
import ResultPanel from './components/ResultPanel'

const DEFAULT_BATCH_SIZE = 64
const hardware = navigator.hardwareConcurrency || 4
const defaultWorkers = Math.max(1, Math.min(8, hardware - 1 || 1))

function randomHexPrefix(byteCount) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount))
  return bytesToHex(bytes)
}

export default function App() {
  const [byteCount, setByteCount] = useState(1)
  const [targetHex, setTargetHex] = useState('')
  const [workerCount, setWorkerCount] = useState(defaultWorkers)
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE)
  const [running, setRunning] = useState(false)
  const [libsReady, setLibsReady] = useState(false)
  const [error, setError] = useState('')
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [rate, setRate] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [result, setResult] = useState(null)

  const poolRef = useRef(null)
  const runningRef = useRef(false)
  const foundRef = useRef(false)
  const rollingSamplesRef = useRef([])
  const tickRef = useRef(null)

  // Keep runningRef in sync
  useEffect(() => { runningRef.current = running }, [running])

  // Initialize on mount
  useEffect(() => {
    const pool = new WorkerPool()
    poolRef.current = pool

    async function init() {
      try {
        const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
        await createMeshCoreCandidateFromKeyPair(keyPair)
        await pool.init(defaultWorkers)
        setLibsReady(true)
      } catch (err) {
        setError(err.message || 'Failed to initialize native crypto support.')
      }
    }
    init()

    // Set initial random prefix
    setTargetHex(randomHexPrefix(1))

    return () => pool.destroy()
  }, [])

  // Trim targetHex when byteCount changes
  useEffect(() => {
    setTargetHex((prev) => {
      const clean = normalizeHex(prev)
      return clean.length > byteCount * 2 ? clean.slice(0, byteCount * 2) : clean
    })
  }, [byteCount])

  // Tick timer for UI updates while running
  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        // Force a re-render so LiveStats picks up elapsed time
        setTotalAttempts((v) => v)
      }, 150)
    } else {
      clearInterval(tickRef.current)
    }
    return () => clearInterval(tickRef.current)
  }, [running])

  const computeRate = useCallback(() => {
    const samples = rollingSamplesRef.current
    if (!samples.length) return 0
    const attempts = samples.reduce((sum, s) => sum + s.attempts, 0)
    const ms = samples.reduce((sum, s) => sum + s.ms, 0)
    return ms > 0 ? (attempts / ms) * 1000 : 0
  }, [])

  function validate() {
    const target = normalizeHex(targetHex)
    if (![1, 2, 4].includes(byteCount)) throw new Error('Prefix length must be 1, 2, or 4 bytes.')
    if (target.length !== byteCount * 2) throw new Error(`Enter exactly ${byteCount * 2} hex characters.`)
    if (!Number.isInteger(workerCount) || workerCount < 1 || workerCount > 16) throw new Error('Worker count must be between 1 and 16.')
    if (!Number.isInteger(batchSize) || batchSize < 8 || batchSize > 512) throw new Error('Batch size must be between 8 and 512.')
    if (isReservedPrefix(target)) throw new Error('Prefixes starting with 00 or FF are reserved and blocked.')
    return target
  }

  async function handleStart() {
    try {
      if (!libsReady) throw new Error('Native Ed25519 WebCrypto support is unavailable in this browser.')
      const target = validate()
      setError('')
      setTotalAttempts(0)
      setRate(0)
      setResult(null)
      rollingSamplesRef.current = []
      foundRef.current = false

      setRunning(true)
      setStartTime(performance.now())

      await poolRef.current.init(workerCount)

      const foundMsg = await poolRef.current.runSearch({
        targetHex: target,
        batchSize,
        onProgress: (attempts, elapsedMs) => {
          setTotalAttempts((prev) => prev + attempts)
          rollingSamplesRef.current.push({ attempts, ms: elapsedMs })
          if (rollingSamplesRef.current.length > 40) rollingSamplesRef.current.shift()
          setRate(computeRate())
        },
        onFound: (msg) => {
          setTotalAttempts((prev) => prev + (msg.attemptsDelta || 0))
        },
      })

      if (!runningRef.current || !foundMsg) {
        setRunning(false)
        return
      }

      const validationMessage = await validateCandidate(foundMsg)
      foundRef.current = true
      setResult({ ...foundMsg, prefix: target, validationMessage })
      setRunning(false)
    } catch (err) {
      setError(err.message || 'Unable to start search.')
      setRunning(false)
    }
  }

  function handleStop() {
    setRunning(false)
    poolRef.current?.stop()
  }

  function handleRandomPrefix() {
    setTargetHex(randomHexPrefix(byteCount))
    setError('')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Generate custom Ed25519 keys for MeshCore</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              MeshCore uses the first bytes of your public key as a <span className="font-semibold text-white">node identifier</span>.
              Choose a prefix to pick your node ID, avoid collisions with neighbors, or just get a memorable address.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
              All processing happens in your browser — keys never leave your device
            </div>
          </div>
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-black/20">
            <div className="font-semibold">Search difficulty</div>
            <div className="mt-1">1 byte is instant. 2 bytes takes seconds. 4 bytes can take a long time even with multiple cores.</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <SearchSettings
            byteCount={byteCount}
            setByteCount={setByteCount}
            targetHex={targetHex}
            setTargetHex={setTargetHex}
            workerCount={workerCount}
            setWorkerCount={setWorkerCount}
            batchSize={batchSize}
            setBatchSize={setBatchSize}
            running={running}
            libsReady={libsReady}
            error={error}
            onStart={handleStart}
            onStop={handleStop}
            onRandomPrefix={handleRandomPrefix}
          />
          <LiveStats
            running={running}
            totalAttempts={totalAttempts}
            rate={rate}
            startTime={startTime}
            byteCount={byteCount}
          />
        </div>

        <ResultPanel result={result} />
      </div>
    </div>
  )
}
