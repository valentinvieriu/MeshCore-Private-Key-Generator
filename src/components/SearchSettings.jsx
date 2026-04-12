import { normalizeHex, isReservedPrefix, formatNumber, expectedAttemptsForBytes } from '../lib/crypto'

const BYTE_OPTIONS = [1, 2, 4]

export default function SearchSettings({
  byteCount, setByteCount, targetHex, setTargetHex,
  workerCount, setWorkerCount, batchSize, setBatchSize,
  running, libsReady, error, onStart, onStop, onRandomPrefix,
}) {
  const expectedAttempts = expectedAttemptsForBytes(byteCount)
  const reserved = isReservedPrefix(targetHex)

  function handleTargetChange(e) {
    const limit = byteCount * 2
    setTargetHex(normalizeHex(e.target.value).slice(0, limit))
  }

  function handleByteChange(value) {
    setByteCount(value)
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Search settings</h2>
        <StatusBadge running={running} libsReady={libsReady} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-200">Prefix length</label>
          <div className="grid grid-cols-3 gap-3">
            {BYTE_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => handleByteChange(b)}
                disabled={running}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${
                  byteCount === b
                    ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {b} byte{b > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="targetHex" className="mb-2 block text-sm font-medium text-slate-200">Desired public key prefix</label>
          <input
            id="targetHex"
            value={targetHex}
            onChange={handleTargetChange}
            disabled={running}
            spellCheck={false}
            autoComplete="off"
            placeholder={`Example: ${'11'.repeat(byteCount)}`}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-base outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-400 disabled:opacity-50"
          />
          <p className="mt-2 text-xs text-slate-400">Enter exactly {byteCount * 2} hex characters for a {byteCount}-byte prefix.</p>
          {reserved && (
            <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Prefixes starting with <span className="font-semibold">00</span> or <span className="font-semibold">FF</span> are reserved and blocked.
            </div>
          )}
        </div>

        <div>
          <label htmlFor="workerCount" className="mb-2 block text-sm font-medium text-slate-200">Parallel workers</label>
          <input
            id="workerCount"
            type="number"
            min={1}
            max={16}
            step={1}
            value={workerCount}
            disabled={running}
            onChange={(e) => setWorkerCount(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none ring-0 transition focus:border-cyan-400 disabled:opacity-50"
          />
          <p className="mt-2 text-xs text-slate-400">Defaults to available CPU threads minus one, capped for responsiveness.</p>
        </div>

        <div>
          <label htmlFor="batchSize" className="mb-2 block text-sm font-medium text-slate-200">Batch size per worker</label>
          <input
            id="batchSize"
            type="number"
            min={8}
            max={512}
            step={8}
            value={batchSize}
            disabled={running}
            onChange={(e) => setBatchSize(Math.max(8, Math.min(512, Number(e.target.value) || 64)))}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none ring-0 transition focus:border-cyan-400 disabled:opacity-50"
          />
          <p className="mt-2 text-xs text-slate-400">Higher is usually faster. Lower improves stop latency on slower devices.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">Expected average work</label>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            <div className="font-semibold text-white">~{formatNumber(expectedAttempts)} attempts</div>
            <div className="mt-1 text-slate-400">Average for a {byteCount}-byte prefix.</div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">Runtime mode</label>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            <div className="font-semibold text-white">Native WebCrypto Ed25519</div>
            <div className="mt-1 text-slate-400">100% client-side. No server calls, no external dependencies.</div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onStart}
          disabled={running || !libsReady}
          className={`rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300 ${
            running || !libsReady ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          Start search
        </button>
        <button
          onClick={onStop}
          disabled={!running}
          className={`rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold transition ${
            running ? 'text-slate-100' : 'cursor-not-allowed text-slate-400 opacity-60'
          }`}
        >
          Stop
        </button>
        <button
          onClick={onRandomPrefix}
          disabled={running}
          className={`rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold transition ${
            running ? 'cursor-not-allowed text-slate-400 opacity-60' : 'text-slate-200 hover:bg-slate-700'
          }`}
        >
          Random prefix
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      )}
    </section>
  )
}

function StatusBadge({ running, libsReady }) {
  if (running) {
    return <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-100">Searching</span>
  }
  if (!libsReady) {
    return <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">Loading</span>
  }
  return <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">Ready</span>
}
