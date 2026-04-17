import { useMemo, useState } from 'react'
import { normalizeHex, isReservedPrefix, formatNumber, expectedAttemptsForHexLength } from '../lib/crypto'
import { createPreviewPublicKeyHex } from '../lib/funkyPrefixes'

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
  presetPrefixes, onPresetClick, onShufflePresets,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const hexLength = normalizeHex(targetHex).length
  const safeHexLength = hexLength || 1
  const expectedAttempts = expectedAttemptsForHexLength(safeHexLength)
  const reserved = isReservedPrefix(targetHex)

  function handleTargetChange(e) {
    setTargetHex(normalizeHex(e.target.value).slice(0, maxHexLength))
  }

  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-900/75 p-5 shadow-[0_24px_90px_-52px_rgba(14,165,233,0.45)] backdrop-blur xl:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label htmlFor="targetHex" className="text-sm font-medium text-slate-200">Desired public key prefix</label>
        <StatusBadge running={running} libsReady={libsReady} />
      </div>

      <div className="mt-2">
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
      </div>

      <LivePrefixPreview targetHex={targetHex} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
          ~{formatNumber(expectedAttempts)} average attempts
        </span>
        <span className="text-sm text-slate-300">{describeTurnaround(safeHexLength)}</span>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {safeHexLength} hex char{safeHexLength !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onStart}
            disabled={running || !libsReady}
            className={`rounded-[18px] bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_18px_42px_-22px_rgba(34,211,238,0.9)] transition hover:bg-cyan-300 ${
              running || !libsReady ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            {libsReady ? 'Start search' : 'Loading crypto...'}
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={!running}
            className={`rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold transition ${
              running ? 'text-slate-100 hover:border-cyan-400/30 hover:bg-slate-900' : 'cursor-not-allowed text-slate-500 opacity-60'
            }`}
          >
            Stop
          </button>
          <button
            type="button"
            onClick={onRandomPrefix}
            disabled={running}
            className={`rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold transition ${
              running ? 'cursor-not-allowed text-slate-500 opacity-60' : 'text-slate-200 hover:border-cyan-400/30 hover:bg-slate-900'
            }`}
          >
            Randomize
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Example IDs</div>
        <button
          type="button"
          onClick={onShufflePresets}
          disabled={running}
          className={`text-sm font-medium transition ${
            running ? 'cursor-not-allowed text-slate-500 opacity-60' : 'text-cyan-200 hover:text-white'
          }`}
        >
          Shuffle
        </button>
      </div>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {presetPrefixes.map((prefix) => (
          <PresetGalleryCard
            key={prefix}
            prefix={prefix}
            selected={targetHex === prefix}
            disabled={running}
            onClick={() => onPresetClick(prefix)}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm">
        <p className={reserved ? 'text-amber-100' : 'text-slate-400'}>
          {reserved
            ? <>Prefixes starting with <span className="font-semibold">00</span> or <span className="font-semibold">FF</span> are reserved and blocked.</>
            : 'Use lowercase hex only. For a fast test run, start short or click a preset above.'}
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

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      )}
    </section>
  )
}

function LivePrefixPreview({ targetHex }) {
  const prefix = normalizeHex(targetHex)
  const previewHex = useMemo(() => (prefix ? createPreviewPublicKeyHex(prefix) : ''), [prefix])

  if (!prefix) {
    return (
      <div className="mt-2.5 rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 px-4 py-2.5 text-xs text-slate-500">
        Type a prefix to preview your ID.
      </div>
    )
  }

  return (
    <div className="mt-2.5 rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">Preview of your ID</div>
      <div className="mt-1 truncate font-mono text-sm leading-6">
        <span className="text-cyan-300">{prefix}</span>
        <span className="text-slate-600">{previewHex.slice(prefix.length, 40)}</span>
        <span className="text-slate-700">...</span>
      </div>
    </div>
  )
}

function PresetGalleryCard({ prefix, selected, disabled, onClick }) {
  const previewHex = useMemo(() => createPreviewPublicKeyHex(prefix), [prefix])
  const baseClasses = 'flex flex-col gap-1 rounded-[18px] border px-3 py-2.5 text-left transition'
  const stateClasses = disabled
    ? 'cursor-not-allowed border-white/10 bg-slate-950/40 opacity-60'
    : selected
      ? 'border-cyan-400/40 bg-cyan-400/15 ring-1 ring-cyan-400/30'
      : 'border-white/10 bg-slate-950/60 hover:border-cyan-400/30 hover:bg-slate-900'

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${baseClasses} ${stateClasses}`}>
      <div className={`text-[10px] font-medium uppercase tracking-[0.22em] ${selected ? 'text-cyan-100' : 'text-slate-500'}`}>
        {selected ? 'Selected' : 'Preview'}
      </div>
      <div className="truncate font-mono text-sm">
        <span className="text-cyan-300">{prefix}</span>
        <span className={selected ? 'text-slate-400' : 'text-slate-600'}>{previewHex.slice(prefix.length, 20)}</span>
        <span className={selected ? 'text-slate-500' : 'text-slate-700'}>...</span>
      </div>
    </button>
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
