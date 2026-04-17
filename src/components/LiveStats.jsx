import { useState, useEffect } from 'react'
import { formatNumber, formatDuration, formatEta, expectedAttemptsForHexLength } from '../lib/crypto'

export default function LiveStats({ runState, running, totalAttempts, startTime, lastElapsedMs, prefixHexLength }) {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(performance.now()), 150)
    return () => clearInterval(id)
  }, [running])

  const elapsedMs = running ? now - startTime : lastElapsedMs
  const elapsedSec = elapsedMs / 1000
  const rate = elapsedSec > 0.5 ? totalAttempts / elapsedSec : 0
  const expectedAttempts = expectedAttemptsForHexLength(prefixHexLength || 1)
  const findProbability = 1 - Math.exp(-totalAttempts / expectedAttempts)
  const medianAttempts = Math.ceil(expectedAttempts * Math.LN2)
  const remainingAttempts = Math.max(0, medianAttempts - totalAttempts)
  const remaining = rate > 0 ? remainingAttempts / rate : NaN
  const probabilityLabel = `${(findProbability * 100).toFixed(findProbability < 0.1 ? 1 : 0)}%`
  const showHistory = runState === 'stopped' || runState === 'found'

  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_24px_90px_-56px_rgba(15,23,42,0.85)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Supporting context</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Live stats</h2>
        </div>
        <RunBadge runState={runState} />
      </div>

      {runState === 'idle' ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
            <div className="text-sm font-medium text-slate-100">Ready to search</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The current prefix averages <span className="font-semibold text-slate-200">~{formatNumber(expectedAttempts)}</span> attempts.
              Search speed mainly depends on available CPU threads, worker count, and batch size.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ReadyCard
              label="Expected work"
              value={`~${formatNumber(expectedAttempts)}`}
              detail={`For ${prefixHexLength || 1} hex char${prefixHexLength === 1 ? '' : 's'}.`}
            />
            <ReadyCard
              label="What affects speed"
              value="Workers + CPU"
              detail="More workers usually improve throughput until the device is saturated."
            />
            <ReadyCard
              label="After start"
              value="Live ETA"
              detail="Attempts, throughput, elapsed time, and 50% ETA appear here while the search runs."
            />
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <StatCard label="Attempts" value={formatNumber(totalAttempts)} />
            <StatCard label="Throughput" value={rate > 0 ? `${formatNumber(Math.round(rate))} / sec` : '0 / sec'} />
            <StatCard label="Elapsed" value={formatDuration(elapsedMs)} />
            <StatCard label="Median ETA" value={running ? formatEta(remaining) : '—'} />
          </div>

          <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/70">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <span className="text-sm font-medium text-slate-100">Chance of finding a match</span>
              <span className="text-xs font-medium text-slate-300">
                {running ? probabilityLabel : showHistory ? `Last run: ${probabilityLabel}` : 'Ready'}
              </span>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="h-3 rounded-full bg-slate-800">
                <div
                  className="h-3 rounded-full bg-linear-to-r from-cyan-300 via-sky-400 to-cyan-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, findProbability * 100)}%` }}
                />
              </div>
              <p className="text-sm leading-6 text-slate-400">
                {running
                  ? 'Probability rises with every attempt. The search stops automatically on the first valid match.'
                  : showHistory
                    ? 'These metrics are preserved from the most recent completed run.'
                    : 'Start a search to see live probability and throughput.'}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-3.5">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
    </div>
  )
}

function ReadyCard({ label, value, detail }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-4">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-base font-semibold text-white">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  )
}

function RunBadge({ runState }) {
  if (runState === 'running') {
    return <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-100">Searching</span>
  }
  if (runState === 'found') {
    return <span className="rounded-full border border-emerald-500/35 bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-100">Match found</span>
  }
  if (runState === 'stopped') {
    return <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100">Last run</span>
  }
  return (
    <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-300">
      Ready
    </span>
  )
}
