import { useState, useRef, useEffect } from 'react'
import { bytesToHex, normalizeHex, isReservedPrefix, finalizeMeshCoreCandidate, validateCandidate } from './lib/crypto'
import { pickRandomFunkyPrefixes } from './lib/funkyPrefixes'
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

function describeDifficulty(length) {
  if (length <= 2) return '1-2 hex chars are usually instant.'
  if (length <= 4) return '3-4 hex chars are typically quick on modern CPUs.'
  if (length <= 6) return '5-6 hex chars can take minutes to hours.'
  return 'Long vanity prefixes can take a very long time.'
}

export default function App() {
  const [targetHex, setTargetHex] = useState('')
  const [workerCount, setWorkerCount] = useState(defaultWorkers)
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE)
  const [running, setRunning] = useState(false)
  const [libsReady, setLibsReady] = useState(false)
  const [error, setError] = useState('')
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [cumulativeAttempts, setCumulativeAttempts] = useState(0)
  const [cumulativePrefix, setCumulativePrefix] = useState('')
  const [startTime, setStartTime] = useState(0)
  const [lastElapsedMs, setLastElapsedMs] = useState(0)
  const [presetPrefixes, setPresetPrefixes] = useState(() => pickRandomFunkyPrefixes(6))
  const [result, setResult] = useState(null)

  const poolRef = useRef(null)
  const runningRef = useRef(false)
  const pendingAttemptsRef = useRef(0)
  const flushRef = useRef(null)
  const startTimeRef = useRef(0)
  const resultSectionRef = useRef(null)

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

  useEffect(() => {
    if (!result || !resultSectionRef.current) return

    const frameId = requestAnimationFrame(() => {
      const el = resultSectionRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      const rect = el.getBoundingClientRect()
      const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
      if (!fullyVisible) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })

    return () => cancelAnimationFrame(frameId)
  }, [result])

  // Flush accumulated progress to React state on a fixed cadence
  useEffect(() => {
    if (running) {
      flushRef.current = setInterval(() => {
        const pending = pendingAttemptsRef.current
        if (pending > 0) {
          pendingAttemptsRef.current = 0
          setTotalAttempts((prev) => prev + pending)
          setCumulativeAttempts((prev) => prev + pending)
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

  function captureElapsed() {
    if (startTimeRef.current > 0) {
      setLastElapsedMs(Math.max(0, performance.now() - startTimeRef.current))
    }
  }

  async function handleStart() {
    try {
      if (!libsReady) throw new Error('WASM Ed25519 crypto is unavailable in this browser.')
      const target = validate()
      const startedAt = performance.now()
      const sessionContinues = target === cumulativePrefix && !result
      setError('')
      setTotalAttempts(0)
      if (!sessionContinues) {
        setCumulativeAttempts(0)
        setCumulativePrefix(target)
      }
      setResult(null)
      setLastElapsedMs(0)
      pendingAttemptsRef.current = 0

      setRunning(true)
      startTimeRef.current = startedAt
      setStartTime(startedAt)

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
        setCumulativeAttempts((prev) => prev + remaining)
      }

      if (!runningRef.current || !foundMsg) {
        captureElapsed()
        setRunning(false)
        return
      }

      // Finalize on main thread (worker posted match immediately to stop others fast)
      const candidate = await finalizeMeshCoreCandidate(foundMsg.seedHex, foundMsg.rawPublicKeyHex)
      const validationMessage = await validateCandidate(candidate)
      setResult({ ...candidate, prefix: target, validationMessage })
      captureElapsed()
      setRunning(false)
    } catch (err) {
      captureElapsed()
      setError(err.message || 'Unable to start search.')
      setRunning(false)
    }
  }

  function handleStop() {
    captureElapsed()
    setRunning(false)
    poolRef.current?.stop()
  }

  function handleRandomPrefix() {
    const length = normalizeHex(targetHex).length || 2
    setTargetHex(randomHexPrefix(length))
    setError('')
  }

  function handlePresetClick(prefix) {
    setTargetHex(prefix.slice(0, MAX_HEX_LENGTH))
    setError('')
  }

  function handleShufflePresets() {
    setPresetPrefixes(pickRandomFunkyPrefixes(6, { exclude: targetHex }))
  }

  const prefixHexLength = normalizeHex(targetHex).length || 1
  const runState = result ? 'found' : running ? 'running' : totalAttempts > 0 || lastElapsedMs > 0 ? 'stopped' : 'idle'

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
        <header>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-100 sm:px-3 sm:text-[11px] sm:tracking-[0.24em]">
            Browser-based MeshCore key generator
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-3xl xl:text-4xl">
            Generate vanity Ed25519 keys for MeshCore
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Pick a public-key prefix and the browser searches until it matches. All crypto stays on your device.
          </p>
        </header>

        <main className="mt-4 space-y-4 sm:mt-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] xl:items-start">
            <div className="min-w-0">
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
                presetPrefixes={presetPrefixes}
                onPresetClick={handlePresetClick}
                onShufflePresets={handleShufflePresets}
              />
            </div>
            <div className="min-w-0 space-y-4">
              {result ? (
                <ResultPanel
                  result={result}
                  totalAttempts={totalAttempts}
                  cumulativeAttempts={cumulativeAttempts}
                  elapsedMs={lastElapsedMs}
                  panelRef={resultSectionRef}
                />
              ) : (
                <LiveStats
                  runState={runState}
                  running={running}
                  totalAttempts={totalAttempts}
                  cumulativeAttempts={cumulativeAttempts}
                  cumulativePrefix={cumulativePrefix}
                  startTime={startTime}
                  lastElapsedMs={lastElapsedMs}
                  prefixHexLength={prefixHexLength}
                />
              )}
            </div>
          </div>
        </main>

        <footer className="mt-6 border-t border-white/10 pt-4 sm:mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6 sm:divide-x sm:divide-white/10">
            <FooterFact
              eyebrow="Browser-only"
              body="Keys never leave your device."
            />
            <FooterFact
              eyebrow="Difficulty"
              body={describeDifficulty(prefixHexLength)}
            />
            <FooterFact
              eyebrow="Reserved"
              body="Prefixes starting with 00 or FF are blocked."
            />
          </div>
        </footer>
      </div>
    </div>
  )
}

function FooterFact({ eyebrow, body }) {
  return (
    <div className="min-w-0 flex-1 sm:pl-6 sm:first:pl-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">{eyebrow}</div>
      <p className="mt-1 text-xs leading-5 text-slate-400">{body}</p>
    </div>
  )
}
