import { useState, useEffect } from 'react'
import { formatNumber, formatDuration, expectedAttemptsForHexLength } from '../lib/crypto'
import {
  computeSearchMetrics,
  getAverageThroughputDisplay,
  getEtaDisplay,
  getThroughputDisplay,
} from '../lib/liveStats'

export default function LiveStats({ runState, running, totalAttempts, startTime, lastElapsedMs, prefixHexLength, matchedPrefix }) {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(performance.now()), 150)
    return () => clearInterval(id)
  }, [running])

  const elapsedMs = running ? now - startTime : lastElapsedMs
  const expectedAttempts = expectedAttemptsForHexLength(prefixHexLength || 1)
  const metrics = computeSearchMetrics({ totalAttempts, elapsedMs, prefixHexLength })
  const findProbability = metrics.findProbability
  const probabilityLabel = `${(findProbability * 100).toFixed(findProbability < 0.1 ? 1 : 0)}%`
  const showHistory = runState === 'stopped'
  const throughputLabel = getThroughputDisplay({ rate: metrics.rate, hasStableRate: metrics.hasStableRate, running })
  const etaLabel = getEtaDisplay({ remainingSeconds: metrics.remainingSeconds, hasStableRate: metrics.hasStableRate, running })
  const averageThroughputLabel = getAverageThroughputDisplay({
    averageRate: metrics.averageRate,
    elapsedSec: metrics.elapsedSec,
    totalAttempts,
  })

  if (runState === 'idle' || (runState === 'stopped' && totalAttempts === 0)) {
    return <IdleOnboarding expectedAttempts={expectedAttempts} />
  }

  const statItems = runState === 'found'
    ? [
        { label: 'Attempts', value: formatNumber(totalAttempts) },
        { label: 'Avg throughput', value: averageThroughputLabel },
        { label: 'Elapsed', value: formatDuration(elapsedMs) },
        { label: 'Matched prefix', value: matchedPrefix, mono: true, accent: true },
      ]
    : [
        { label: 'Attempts', value: formatNumber(totalAttempts) },
        { label: 'Throughput', value: throughputLabel },
        { label: 'Elapsed', value: formatDuration(elapsedMs) },
        { label: 'Likely time', value: etaLabel },
      ]

  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_24px_90px_-56px_rgba(15,23,42,0.85)] backdrop-blur">
      <div className="flex items-center justify-end">
        <RunBadge runState={runState} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {statItems.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            mono={item.mono}
            accent={item.accent}
          />
        ))}
      </div>

      {runState === 'found' ? (
        <SuccessSummary
          attempts={formatNumber(totalAttempts)}
          elapsed={formatDuration(elapsedMs)}
          matchedPrefix={matchedPrefix}
          throughput={averageThroughputLabel}
        />
      ) : (
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
                  ? 'These metrics are preserved from the most recent stopped run.'
                  : 'Start a search to see live probability and throughput.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

function StatCard({ label, value, mono = false, accent = false }) {
  return (
    <div className={`rounded-[22px] border p-3.5 ${
      accent ? 'border-cyan-400/20 bg-cyan-400/8' : 'border-white/10 bg-slate-950/70'
    }`}>
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${accent ? 'text-cyan-100' : 'text-white'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
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

function IdleOnboarding({ expectedAttempts }) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-slate-900/60 p-4">
      <div className="text-sm font-medium text-slate-100">How the run unfolds</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <OnboardingCard
          step="1"
          title="Choose a prefix"
          body={`The current target averages about ${formatNumber(expectedAttempts)} attempts.`}
        />
        <OnboardingCard
          step="2"
          title="Start the search"
          body="Workers keep generating candidates until the first valid match appears."
        />
        <OnboardingCard
          step="3"
          title="Copy the result"
          body="The MeshCore key is surfaced first, with verification and exports kept secondary."
        />
      </div>
    </section>
  )
}

function OnboardingCard({ step, title, body }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-slate-950/65 p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-200">Step {step}</div>
      <div className="mt-2 text-sm font-medium text-slate-100">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  )
}

function SuccessSummary({ attempts, elapsed, matchedPrefix, throughput }) {
  return (
    <div className="mt-4 rounded-[24px] border border-emerald-500/25 bg-emerald-500/8 p-4">
      <div className="text-sm font-medium text-emerald-100">Search completed</div>
      <p className="mt-2 text-sm leading-6 text-slate-200">
        A matching public key for <span className="font-mono text-emerald-100">{matchedPrefix}</span> was found after{' '}
        <span className="font-medium text-white">{attempts}</span> attempts in{' '}
        <span className="font-medium text-white">{elapsed}</span>.
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Average throughput for the completed run was <span className="font-medium text-white">{throughput}</span>.
      </p>
    </div>
  )
}
