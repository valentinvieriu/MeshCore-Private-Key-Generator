import { useState, useEffect } from 'react'
import { formatNumber, formatDuration, formatEta, expectedAttemptsForHexLength } from '../lib/crypto'

export default function LiveStats({ running, totalAttempts, startTime, prefixHexLength }) {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(performance.now()), 150)
    return () => clearInterval(id)
  }, [running])

  const elapsedMs = running ? now - startTime : 0
  const elapsedSec = elapsedMs / 1000
  // Wall-clock rate: total attempts across all workers / real elapsed time
  const rate = elapsedSec > 0.5 ? totalAttempts / elapsedSec : 0
  const expectedAttempts = expectedAttemptsForHexLength(prefixHexLength)
  const progressRatio = Math.min(1, totalAttempts / expectedAttempts)
  const remaining = rate > 0 ? Math.max(0, (expectedAttempts - totalAttempts) / rate) : NaN

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <h2 className="text-xl font-semibold">Live stats</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <StatCard label="Attempts" value={formatNumber(totalAttempts)} />
        <StatCard label="Throughput" value={rate > 0 ? `${formatNumber(Math.round(rate))} / sec` : '0 / sec'} />
        <StatCard label="Elapsed" value={formatDuration(elapsedMs)} />
        <StatCard label="Estimated time" value={running ? formatEta(remaining) : '—'} />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <span className="text-sm font-medium text-slate-200">Progress</span>
          <span className="text-xs text-slate-400">
            {running
              ? `${Math.min(100, progressRatio * 100).toFixed(progressRatio < 0.1 ? 1 : 0)}% of average search space`
              : 'Ready'}
          </span>
        </div>
        <div className="h-3 w-full bg-slate-900">
          <div
            className="h-3 bg-cyan-400 transition-all duration-300"
            style={{ width: `${Math.min(100, progressRatio * 100)}%` }}
          />
        </div>
      </div>
    </section>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  )
}
