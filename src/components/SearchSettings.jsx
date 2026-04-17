import { useState } from 'react'
import { normalizeHex, isReservedPrefix, formatNumber, expectedAttemptsForHexLength } from '../lib/crypto'
import { pickRandomFunkyPrefixes } from '../lib/funkyPrefixes'

const SUGGESTION_COUNT = 6

function describeTurnaround(hexLength) {
  if (hexLength <= 2) return 'Quick enough for a first run.'
  if (hexLength <= 4) return 'Usually seconds to minutes depending on hardware.'
  if (hexLength <= 6) return 'Longer search; throughput matters more here.'
  return 'Expect a long-running vanity search.'
}

export default function SearchSettings({
  targetHex, setTargetHex, maxHexLength,
  workerCount, setWorkerCount, batchSize, setBatchSize,
  running, libsReady, error, maxWorkers, onStart, onStop, onRandomPrefix,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [funkySuggestions, setFunkySuggestions] = useState(() => pickRandomFunkyPrefixes(SUGGESTION_COUNT))
  const hexLength = normalizeHex(targetHex).length
  const safeHexLength = hexLength || 1
  const expectedAttempts = expectedAttemptsForHexLength(safeHexLength)
  const reserved = isReservedPrefix(targetHex)

  function handleTargetChange(e) {
    setTargetHex(normalizeHex(e.target.value).slice(0, maxHexLength))
  }

  function handlePresetClick(prefix) {
    setTargetHex(prefix.slice(0, maxHexLength))
  }

  function handleShuffleSuggestions() {
    setFunkySuggestions(pickRandomFunkyPrefixes(SUGGESTION_COUNT, { exclude: targetHex }))
  }

  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-900/75 p-5 shadow-[0_24px_90px_-52px_rgba(14,165,233,0.45)] backdrop-blur xl:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-200/70">Primary flow</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Choose the prefix you want to own</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">Enter 1 to {maxHexLength} hex characters. Shorter prefixes complete quickly.</p>
        </div>
        <StatusBadge running={running} libsReady={libsReady} />
      </div>

      <div className="mt-4">
        <label htmlFor="targetHex" className="mb-2 block text-sm font-medium text-slate-200">Desired public key prefix</label>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
          <div>
            <input
              id="targetHex"
              value={targetHex}
              onChange={handleTargetChange}
              disabled={running}
              maxLength={maxHexLength}
              spellCheck={false}
              autoComplete="off"
              placeholder="Example: ab or c0ffee"
              className={`w-full rounded-[22px] border bg-slate-950/90 px-4 py-4 font-mono text-xl tracking-[0.18em] text-slate-100 outline-none transition placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-400 disabled:opacity-50 ${
                reserved ? 'border-amber-400/50 focus:border-amber-300' : 'border-white/10'
              }`}
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
                ~{formatNumber(expectedAttempts)} average attempts
              </span>
              <span className="text-sm text-slate-300">{describeTurnaround(safeHexLength)}</span>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {safeHexLength} hex char{safeHexLength !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={onStart}
              disabled={running || !libsReady}
              className={`rounded-[22px] bg-cyan-400 px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_18px_42px_-22px_rgba(34,211,238,0.9)] transition hover:bg-cyan-300 ${
                running || !libsReady ? 'cursor-not-allowed opacity-60' : ''
              }`}
            >
              {libsReady ? 'Start search' : 'Loading crypto...'}
            </button>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <button
                type="button"
                onClick={onStop}
                disabled={!running}
                className={`rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-semibold transition ${
                  running ? 'text-slate-100 hover:border-cyan-400/30 hover:bg-slate-900' : 'cursor-not-allowed text-slate-500 opacity-60'
                }`}
              >
                Stop
              </button>
              <button
                type="button"
                onClick={onRandomPrefix}
                disabled={running}
                className={`rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-semibold transition ${
                  running ? 'cursor-not-allowed text-slate-500 opacity-60' : 'text-slate-200 hover:border-cyan-400/30 hover:bg-slate-900'
                }`}
              >
                Randomize
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Funky ideas</div>
          <button
            type="button"
            onClick={handleShuffleSuggestions}
            disabled={running}
            className={`text-sm font-medium transition ${
              running ? 'cursor-not-allowed text-slate-500 opacity-60' : 'text-cyan-200 hover:text-white'
            }`}
          >
            Shuffle
          </button>
          <span className="text-sm text-slate-500">Pick one and keep moving.</span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {funkySuggestions.map((prefix) => (
            <button
              key={prefix}
              type="button"
              onClick={() => handlePresetClick(prefix)}
              disabled={running}
              className={`rounded-full border px-3 py-1.5 font-mono text-sm transition ${
                running
                  ? 'cursor-not-allowed border-white/10 bg-slate-800/80 text-slate-500'
                  : targetHex === prefix
                    ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
                    : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-cyan-400/30 hover:text-white'
              }`}
            >
              {prefix}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm">
          <p className={reserved ? 'text-amber-100' : 'text-slate-400'}>
            {reserved
              ? <>Prefixes starting with <span className="font-semibold">00</span> or <span className="font-semibold">FF</span> are reserved and blocked.</>
              : 'Use lowercase hex only. For a fast test run, start short or use a preset.'}
          </p>
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="font-medium text-cyan-200 transition hover:text-white"
          >
            {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-3 grid gap-4 rounded-[22px] border border-white/10 bg-slate-950/45 p-4 md:grid-cols-2">
            <div>
              <label htmlFor="workerCount" className="mb-2 block text-sm font-medium text-slate-200">Parallel workers</label>
              <input
                id="workerCount"
                type="number"
                min={1}
                max={maxWorkers}
                step={1}
                value={workerCount}
                disabled={running}
                onChange={(e) => setWorkerCount(Math.max(1, Math.min(maxWorkers, Number(e.target.value) || 1)))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-400 disabled:opacity-50"
              />
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Defaults to available CPU threads minus one so the UI keeps a core free.
              </p>
            </div>

            <div>
              <label htmlFor="batchSize" className="mb-2 block text-sm font-medium text-slate-200">Batch size per worker</label>
              <input
                id="batchSize"
                type="number"
                min={8}
                max={4096}
                step={64}
                value={batchSize}
                disabled={running}
                onChange={(e) => setBatchSize(Math.max(8, Math.min(4096, Number(e.target.value) || 512)))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-400 disabled:opacity-50"
              />
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Higher is usually faster. Lower values improve stop latency on slower devices.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      )}
    </section>
  )
}

function StatusBadge({ running, libsReady }) {
  if (running) {
    return <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-100">Searching</span>
  }
  if (!libsReady) {
    return <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100">Loading crypto</span>
  }
  return <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">Ready</span>
}
