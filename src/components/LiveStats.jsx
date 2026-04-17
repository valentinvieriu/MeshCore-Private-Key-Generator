import { useState, useEffect } from 'react'
import { formatNumber, formatDuration } from '../lib/crypto'
import {
  attemptsForOdds,
  computeSearchMetrics,
  getCohortWarning,
  getMilestoneEtaDisplay,
  getMilestoneEtaSeconds,
  getMilestonePosition,
  getThroughputDisplay,
} from '../lib/liveStats'
import IntroPanel from './IntroPanel'

const MILESTONE_TARGETS = [
  { p: 0.5, label: '50% odds by' },
  { p: 0.9, label: '90% odds by' },
  { p: 0.99, label: '99% odds by' },
]

const AXIS_TICKS = [
  { value: 0.5, label: '50%' },
  { value: 1 - 1 / Math.E, label: '63%' },
  { value: 0.95, label: '95%' },
]

const WARNING_COPY = {
  'past-mean': 'About 37% of searches take this long or longer. The next attempt is just as likely to hit as the first.',
  'past-p95': '95% of searches for this prefix would have finished by now. Per-attempt odds are unchanged.',
  'past-p999': "You're in the extreme tail. Expected remaining work is unchanged — consider a shorter prefix.",
}

const WARNING_LABEL = {
  'past-mean': 'Past mean (63%)',
  'past-p95': 'In the 95% tail',
  'past-p999': 'Extreme tail (>99.9%)',
}

export default function LiveStats({
  runState,
  running,
  totalAttempts,
  cumulativeAttempts,
  cumulativePrefix,
  startTime,
  lastElapsedMs,
  prefixHexLength,
}) {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(performance.now()), 150)
    return () => clearInterval(id)
  }, [running])

  const elapsedMs = running ? now - startTime : lastElapsedMs
  const effectiveCumulative = Number.isFinite(cumulativeAttempts) ? cumulativeAttempts : totalAttempts
  const metrics = computeSearchMetrics({
    totalAttempts,
    elapsedMs,
    prefixHexLength,
    cumulativeAttempts: effectiveCumulative,
  })
  const carriedAttempts = Math.max(0, effectiveCumulative - totalAttempts)
  const showHistory = runState === 'stopped'
  const throughputLabel = getThroughputDisplay({ rate: metrics.rate, hasStableRate: metrics.hasStableRate, running })
  const throughputHasRate = running && metrics.hasStableRate && metrics.rate > 0
  const throughputValue = throughputHasRate ? formatNumber(Math.round(metrics.rate)) : throughputLabel
  const throughputUnit = throughputHasRate ? '/ sec' : null

  if (runState === 'idle' || (runState === 'stopped' && totalAttempts === 0)) {
    return <IntroPanel prefixHexLength={prefixHexLength} />
  }

  const statItems = [
    { label: 'Attempts', value: formatNumber(totalAttempts), secondary: carriedAttempts > 0 ? `+${formatNumber(carriedAttempts)} from earlier runs` : null },
    { label: 'Throughput', value: throughputValue, unit: throughputUnit },
    { label: 'Elapsed', value: formatDuration(elapsedMs) },
  ]

  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_24px_90px_-56px_rgba(15,23,42,0.85)] backdrop-blur">
      <div className="flex items-center justify-end">
        <RunBadge runState={runState} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {statItems.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            unit={item.unit}
            secondary={item.secondary}
          />
        ))}
      </div>

      <SearchCohortIndicator
        metrics={metrics}
        cumulativeAttempts={effectiveCumulative}
        cumulativePrefix={cumulativePrefix}
        running={running}
        showHistory={showHistory}
      />
    </section>
  )
}

function SearchCohortIndicator({ metrics, cumulativeAttempts, cumulativePrefix, running, showHistory }) {
  const { cohortFraction, expectedAttempts, rate, hasStableRate } = metrics
  const { markerPct } = getMilestonePosition({ cumulativeAttempts, expectedAttempts })
  const warning = getCohortWarning(cohortFraction)
  const warningLabel = warning ? WARNING_LABEL[warning] : null
  const oddsPercentLabel = formatOddsPercent(cohortFraction)
  const headerPrefix = warningLabel ?? (running ? 'Cumulative odds:' : showHistory ? 'Last run odds:' : 'Ready')
  const headerShowsOdds = !warningLabel && (running || showHistory)

  const milestoneRows = MILESTONE_TARGETS.map(({ p, label }) => {
    const etaSeconds = getMilestoneEtaSeconds({ p, cumulativeAttempts, expectedAttempts, rate })
    const display = getMilestoneEtaDisplay({ etaSeconds, hasStableRate, running })
    const targetAttempts = attemptsForOdds(p, expectedAttempts)
    return { p, label, display, targetAttempts }
  })

  const prefixLabel = cumulativePrefix ? `for ${cumulativePrefix}` : ''

  return (
    <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/70">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <span className="text-sm font-medium text-slate-100">Search cohort position</span>
        <span className="flex items-baseline gap-1 text-xs font-medium text-slate-300">
          <span>{headerPrefix}</span>
          {headerShowsOdds && <span className="inline-block min-w-[5ch] text-right tabular-nums">{oddsPercentLabel}</span>}
        </span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="rounded-[18px] border border-white/10 bg-slate-900/60 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-200">
            Cumulative odds {prefixLabel}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="inline-block min-w-[6ch] text-3xl font-semibold tracking-tight text-cyan-100 tabular-nums">{oddsPercentLabel}</span>
            <span className="text-xs text-slate-400">that at least one attempt has matched by now</span>
          </div>
        </div>

        <CohortAxis markerPct={markerPct} />

        <p className="text-sm leading-6 text-slate-400">
          Each attempt is independent. This is not percent complete. More attempts improve the odds that one has already matched.
        </p>

        <div className="overflow-hidden rounded-[18px] border border-white/10">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-white/5">
              {milestoneRows.map(({ p, label, display, targetAttempts }) => (
                <tr key={p}>
                  <td className="px-4 py-2 text-slate-300">{label}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-slate-500">
                    ~{formatNumber(Math.round(targetAttempts))} attempts
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-100">{display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {warning && (
          <p className="rounded-[14px] border-l-2 border-amber-400/40 bg-amber-400/5 px-3 py-2 text-sm leading-6 text-amber-100/90">
            {WARNING_COPY[warning]}
          </p>
        )}

        {showHistory && !warning && (
          <p className="text-xs text-slate-500">These metrics are preserved from the most recent stopped run.</p>
        )}
      </div>
    </div>
  )
}

function CohortAxis({ markerPct }) {
  const safePct = Math.max(0, Math.min(1, markerPct))
  const ariaLabel = `Cumulative odds marker at ${(safePct * 100).toFixed(1)}%`

  return (
    <div className="relative h-12 select-none" role="img" aria-label={ariaLabel}>
      <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-700" />

      {AXIS_TICKS.map((tick) => (
        <div
          key={tick.label}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${tick.value * 100}%` }}
        >
          <div className="mx-auto h-3 w-px bg-slate-500" />
          <div className="mt-1 text-[10px] tracking-wide text-slate-500">{tick.label}</div>
        </div>
      ))}

      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-300"
        style={{ left: `${safePct * 100}%` }}
      >
        <span className="block h-5 w-[3px] rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, secondary }) {
  return (
    <div className="min-w-0 rounded-[22px] border border-white/10 bg-slate-950/70 p-3.5">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 flex items-baseline gap-1 truncate text-xl font-semibold tracking-tight text-white tabular-nums">
        <span className="truncate">{value}</span>
        {unit && <span className="shrink-0 text-xs font-normal text-slate-400">{unit}</span>}
      </div>
      {secondary && (
        <div className="mt-1 truncate text-xs text-slate-400">{secondary}</div>
      )}
    </div>
  )
}

function formatOddsPercent(fraction) {
  if (!Number.isFinite(fraction) || fraction <= 0) return '0.00%'
  if (fraction >= 0.9999) return '>99.99%'
  return `${(fraction * 100).toFixed(2)}%`
}

function RunBadge({ runState }) {
  if (runState === 'running') {
    return <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-100">Searching</span>
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
