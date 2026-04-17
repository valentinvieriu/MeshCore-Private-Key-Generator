import { useState, useRef, useEffect } from 'react'
import { bytesToHex, normalizeHex, isReservedPrefix, finalizeMeshCoreCandidate, validateCandidate } from './lib/crypto'
import { WorkerPool } from './lib/workerPool'
import SearchSettings from './components/SearchSettings'
import LiveStats from './components/LiveStats'
import ResultPanel from './components/ResultPanel'

const DEFAULT_BATCH_SIZE = 512
const MAX_HEX_LENGTH = 8
const hardware = navigator.hardwareConcurrency || 4
const defaultWorkers = Math.max(1, hardware - 1)

function randomHexPrefix(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)))
  let hex = bytesToHex(bytes).slice(0, length)
  while (isReservedPrefix(hex)) {
    crypto.getRandomValues(bytes)
    hex = bytesToHex(bytes).slice(0, length)
  }
  return hex
}

export default function App() {
  const [targetHex, setTargetHex] = useState('')
  const [workerCount, setWorkerCount] = useState(defaultWorkers)
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE)
  const [running, setRunning] = useState(false)
  const [libsReady, setLibsReady] = useState(false)
  const [error, setError] = useState('')
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [result, setResult] = useState(null)

  const poolRef = useRef(null)
  const runningRef = useRef(false)
  const foundRef = useRef(false)
  const pendingAttemptsRef = useRef(0)
  const flushRef = useRef(null)

  // Keep runningRef in sync
  useEffect(() => { runningRef.current = running }, [running])

  // Initialize on mount
  useEffect(() => {
    const pool = new WorkerPool()
    poolRef.current = pool

    async function init() {
      try {
        // Verify WebCrypto Ed25519 support (needed for PKCS8 export on match)
        const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
        const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey)
        if (rawPub.byteLength !== 32) throw new Error('Unexpected public key length')
        await pool.init(defaultWorkers)
        setLibsReady(true)
      } catch (err) {
        setError(err.message || 'Failed to initialize crypto.')
      }
    }
    init()

    // Set initial random prefix
    setTargetHex(randomHexPrefix(2))

    return () => pool.destroy()
  }, [])

  // Flush accumulated progress to React state on a fixed cadence
  useEffect(() => {
    if (running) {
      flushRef.current = setInterval(() => {
        const pending = pendingAttemptsRef.current
        if (pending > 0) {
          pendingAttemptsRef.current = 0
          setTotalAttempts((prev) => prev + pending)
        }
      }, 200)
    } else {
      clearInterval(flushRef.current)
    }
    return () => clearInterval(flushRef.current)
  }, [running])

  function validate() {
    const target = normalizeHex(targetHex)
    if (target.length < 1 || target.length > MAX_HEX_LENGTH) throw new Error(`Enter 1 to ${MAX_HEX_LENGTH} hex characters.`)
    if (!Number.isInteger(workerCount) || workerCount < 1 || workerCount > hardware) throw new Error(`Worker count must be between 1 and ${hardware}.`)
    if (!Number.isInteger(batchSize) || batchSize < 8 || batchSize > 4096) throw new Error('Batch size must be between 8 and 4096.')
    if (isReservedPrefix(target)) throw new Error('Prefixes starting with 00 or FF are reserved and blocked.')
    return target
  }

  async function handleStart() {
    try {
      if (!libsReady) throw new Error('WASM Ed25519 crypto is unavailable in this browser.')
      const target = validate()
      setError('')
      setTotalAttempts(0)
      setResult(null)
      pendingAttemptsRef.current = 0
      foundRef.current = false

      setRunning(true)
      setStartTime(performance.now())

      await poolRef.current.init(workerCount)

      const foundMsg = await poolRef.current.runSearch({
        targetHex: target,
        batchSize,
        onProgress: (attempts) => {
          pendingAttemptsRef.current += attempts
        },
        onFound: (msg) => {
          pendingAttemptsRef.current += (msg.attemptsDelta || 0)
        },
      })

      // Final flush of pending attempts
      const remaining = pendingAttemptsRef.current
      if (remaining > 0) {
        pendingAttemptsRef.current = 0
        setTotalAttempts((prev) => prev + remaining)
      }

      if (!runningRef.current || !foundMsg) {
        setRunning(false)
        return
      }

      // Finalize on main thread (worker posted match immediately to stop others fast)
      const candidate = await finalizeMeshCoreCandidate(foundMsg.seedHex, foundMsg.rawPublicKeyHex)
      const validationMessage = await validateCandidate(candidate)
      foundRef.current = true
      setResult({ ...candidate, prefix: target, validationMessage })
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
    const length = normalizeHex(targetHex).length || 2
    setTargetHex(randomHexPrefix(length))
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
            <div className="mt-1">Each hex character multiplies difficulty by 16. 1-2 chars is instant, 5+ can take a while.</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <SearchSettings
            targetHex={targetHex}
            setTargetHex={setTargetHex}
            maxHexLength={MAX_HEX_LENGTH}
            workerCount={workerCount}
            setWorkerCount={setWorkerCount}
            batchSize={batchSize}
            setBatchSize={setBatchSize}
            running={running}
            libsReady={libsReady}
            error={error}
            maxWorkers={hardware}
            onStart={handleStart}
            onStop={handleStop}
            onRandomPrefix={handleRandomPrefix}
          />
          <LiveStats
            running={running}
            totalAttempts={totalAttempts}
            startTime={startTime}
            prefixHexLength={normalizeHex(targetHex).length}
          />
        </div>

        <ResultPanel result={result} />
      </div>
    </div>
  )
}
