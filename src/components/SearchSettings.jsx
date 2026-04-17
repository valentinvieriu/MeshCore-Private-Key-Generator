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
  const normalizedTarget = normalizeHex(targetHex)
  const hexLength = normalizedTarget.length
  const safeHexLength = hexLength || 1
  const expectedAttempts = expectedAttemptsForHexLength(safeHexLength)
  const reserved = isReservedPrefix(normalizedTarget)
  const hasTarget = hexLength > 0
  const canStart = libsReady && !running && hasTarget && !reserved
  const advancedSummary = `${workerCount} worker${workerCount === 1 ? '' : 's'} · batch ${formatNumber(batchSize)}`
  const helperMessage = reserved
    ? 'Prefixes starting with 00 or ff are reserved and blocked.'
    : hasTarget
      ? 'The browser keeps searching until the first matching public key is found.'
      : `Enter 1-${maxHexLength} lowercase hex chars to begin.`

  function handleTargetChange(e) {
    setTargetHex(normalizeHex(e.target.value).slice(0, maxHexLength))
  }

  function handleTargetKeyDown(e) {
    if (e.key === 'Enter' && canStart) {
      e.preventDefault()
      onStart()
    }
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
          onKeyDown={handleTargetKeyDown}
          disabled={running}
          maxLength={maxHexLength}
          spellCheck={false}
          autoComplete="off"
          placeholder="Example: ab or c0ffee"
          aria-describedby="prefixRules prefixHelper"
          className={`w-full rounded-[22px] border bg-slate-950/90 px-4 py-4 font-mono text-xl tracking-[0.18em] text-slate-100 outline-none transition placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-400 disabled:opacity-50 ${
            reserved ? 'border-amber-400/50 focus:border-amber-300' : 'border-white/10'
          }`}
        />
      </div>

      <div id="prefixRules" className="mt-3 flex flex-wrap items-center gap-2">
        <RulePill>1-{maxHexLength} hex chars</RulePill>
        <RulePill>lowercase only</RulePill>
        <RulePill>00 / ff blocked</RulePill>
        <span className={`ml-auto rounded-full border px-3 py-1 text-xs font-medium ${
          hasTarget
            ? 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100'
            : 'border-white/10 bg-slate-950/60 text-slate-400'
        }`}>
          {hexLength}/{maxHexLength} chars
        </span>
      </div>

      <LivePrefixPreview targetHex={targetHex} />

      <div
        id="prefixHelper"
        className={`mt-3 rounded-[18px] border px-4 py-3 ${
          reserved ? 'border-amber-400/25 bg-amber-400/8' : 'border-white/10 bg-slate-950/55'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="font-medium text-slate-100">~{formatNumber(expectedAttempts)} average attempts</span>
          <span className="text-slate-300">{describeTurnaround(safeHexLength)}</span>
          {canStart && <span className="text-cyan-200">Press Enter to start.</span>}
        </div>
        <p className={`mt-2 text-xs leading-5 ${reserved ? 'text-amber-100' : 'text-slate-400'}`}>
          {helperMessage}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!running && (
          <>
            <button
              type="button"
              onClick={onStart}
              disabled={!canStart}
              className={`rounded-[18px] bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_18px_42px_-22px_rgba(34,211,238,0.9)] transition hover:bg-cyan-300 ${
                !canStart ? 'cursor-not-allowed opacity-60' : ''
              }`}
            >
              {libsReady ? 'Start search' : 'Loading crypto...'}
            </button>
            <button
              type="button"
              onClick={onRandomPrefix}
              className="rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:bg-slate-900"
            >
              Randomize
            </button>
            <span className="ml-auto text-xs uppercase tracking-[0.2em] text-slate-500">
              {safeHexLength} hex char{safeHexLength !== 1 ? 's' : ''}
            </span>
          </>
        )}
        {running && (
          <>
            <button
              type="button"
              onClick={onStop}
              className="rounded-[18px] border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
            >
              Stop search
            </button>
            <span className="text-sm text-slate-300">
              Searching across <span className="font-medium text-slate-100">{workerCount}</span> worker{workerCount === 1 ? '' : 's'}.
            </span>
          </>
        )}
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

      <div className="mt-4 border-t border-white/10 pt-3">
        <button
          type="button"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex w-full flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-slate-950/45 px-4 py-3 text-left transition hover:border-cyan-400/25 hover:bg-slate-950/60"
        >
          <div>
            <div className="text-sm font-medium text-slate-100">Advanced settings</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {advancedSummary}. Adjust only if you want a different speed versus responsiveness tradeoff.
            </p>
          </div>
          <span className="text-sm font-medium text-cyan-200">
            {showAdvanced ? 'Hide' : 'Show'}
          </span>
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
    ? 'cursor-not-allowed border-white/10 bg-slate-950/25 opacity-60'
    : selected
      ? 'border-cyan-400/45 bg-cyan-400/12 shadow-[0_18px_48px_-34px_rgba(34,211,238,0.8)] ring-1 ring-cyan-400/35'
      : 'border-white/10 bg-slate-950/35 hover:border-cyan-400/25 hover:bg-slate-950/55'

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

function RulePill({ children }) {
  return (
    <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-400">
      {children}
    </span>
  )
}
