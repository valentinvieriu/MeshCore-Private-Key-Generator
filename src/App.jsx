import { useState, useRef, useEffect } from 'react'
import { bytesToHex, normalizeHex, isReservedPrefix, finalizeMeshCoreCandidate, validateCandidate } from './lib/crypto'
import { pickRandomFunkyPrefixes, createPreviewPublicKeyHex } from './lib/funkyPrefixes'
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

function createHeaderPreviewExamples() {
  return pickRandomFunkyPrefixes(3).map((prefix) => ({
    prefix,
    previewHex: createPreviewPublicKeyHex(prefix),
  }))
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
  const [lastElapsedMs, setLastElapsedMs] = useState(0)
  const [headerPreviewExamples] = useState(() => createHeaderPreviewExamples())
  const [result, setResult] = useState(null)

  const poolRef = useRef(null)
  const runningRef = useRef(false)
  const pendingAttemptsRef = useRef(0)
  const flushRef = useRef(null)
  const startTimeRef = useRef(0)

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
      setError('')
      setTotalAttempts(0)
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

  const prefixHexLength = normalizeHex(targetHex).length || 1
  const runState = result ? 'found' : running ? 'running' : totalAttempts > 0 || lastElapsedMs > 0 ? 'stopped' : 'idle'

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <header className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-100">
              Browser-based MeshCore key generator
            </div>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl xl:text-[3.35rem] xl:leading-[1.02]">
              Generate custom Ed25519 keys for MeshCore
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              MeshCore uses the first bytes of your public key as a <span className="font-semibold text-white">node identifier</span>.
              Choose a prefix to pick your node ID, avoid collisions with neighbors, or just get a memorable address.
            </p>
            <div className="mt-4 rounded-[22px] border border-white/10 bg-slate-950/40 p-3.5">
              <div>
                <div className="text-sm font-medium text-white">Here is how a custom public key can look</div>
                <p className="mt-1 text-sm leading-6 text-slate-400">Fresh examples built from curated funky prefixes on every page load.</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {headerPreviewExamples.map((example) => (
                  <PreviewExampleChip key={example.previewHex} prefix={example.prefix} previewHex={example.previewHex} />
                ))}
              </div>
            </div>
          </div>
          <aside className="rounded-[26px] border border-white/10 bg-slate-900/70 p-4 shadow-[0_24px_90px_-48px_rgba(14,165,233,0.3)] backdrop-blur">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Quick facts</div>
            <div className="mt-3 divide-y divide-white/10">
              <ContextRow
                eyebrow="Safe by default"
                title="Browser-only key generation"
                body="All processing stays on your device and keys never leave the browser."
                tone="emerald"
              />
              <ContextRow
                eyebrow="Difficulty"
                title="Each extra hex char multiplies work by 16"
                body={describeDifficulty(prefixHexLength)}
                tone="amber"
              />
              <ContextRow
                eyebrow="Next step"
                title={running ? 'Search is active' : 'Start with a short prefix'}
                body={running
                  ? 'Live attempts and ETA update on the right.'
                  : 'Start with 1-2 hex chars. Tuning stays hidden until you need it.'}
                tone="cyan"
              />
            </div>
          </aside>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
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
            runState={runState}
            running={running}
            totalAttempts={totalAttempts}
            startTime={startTime}
            lastElapsedMs={lastElapsedMs}
            prefixHexLength={prefixHexLength}
          />
        </div>

        <ResultPanel result={result} runState={runState} />
      </div>
    </div>
  )
}

function PreviewExampleChip({ prefix, previewHex }) {
  return (
    <div className="min-w-[13rem] flex-1 rounded-[18px] border border-white/10 bg-slate-900/75 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Custom ID preview</div>
      <div className="mt-1 font-mono text-sm text-slate-300">
        <span className="text-cyan-300">{prefix}</span>
        {previewHex.slice(prefix.length, 16)}
        <span className="text-slate-500">...</span>
      </div>
    </div>
  )
}

function ContextRow({ eyebrow, title, body, tone }) {
  const tones = {
    emerald: 'text-emerald-200',
    amber: 'text-amber-200',
    cyan: 'text-cyan-200',
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className={`text-[11px] font-medium uppercase tracking-[0.24em] ${tones[tone]}`}>{eyebrow}</div>
      <div className="mt-1 text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  )
}
