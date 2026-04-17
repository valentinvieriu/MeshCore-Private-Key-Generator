import { expectedAttemptsForHexLength, formatEta, formatNumber } from './crypto'

const RATE_STABILIZE_MS = 500
const MEAN_ODDS = 1 - 1 / Math.E

export function computeSearchMetrics({ totalAttempts, elapsedMs, prefixHexLength, cumulativeAttempts }) {
  const safeElapsedMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0
  const elapsedSec = safeElapsedMs / 1000
  const hasStableRate = safeElapsedMs > RATE_STABILIZE_MS
  const rate = hasStableRate && elapsedSec > 0 ? totalAttempts / elapsedSec : 0
  const expectedAttempts = expectedAttemptsForHexLength(prefixHexLength || 1)
  const cumAttempts = Number.isFinite(cumulativeAttempts) ? cumulativeAttempts : totalAttempts
  const cohortFraction = computeCohortFraction(cumAttempts, expectedAttempts)
  const medianAttempts = Math.ceil(expectedAttempts * Math.LN2)
  const remainingAttempts = Math.max(0, medianAttempts - cumAttempts)
  const remainingSeconds = rate > 0 ? remainingAttempts / rate : NaN
  const averageRate = elapsedSec > 0 ? totalAttempts / elapsedSec : 0

  return {
    averageRate,
    cohortFraction,
    elapsedSec,
    expectedAttempts,
    hasStableRate,
    meanAttempts: expectedAttempts,
    medianAttempts,
    rate,
    remainingAttempts,
    remainingSeconds,
  }
}

export function computeCohortFraction(attempts, expectedAttempts) {
  if (!Number.isFinite(attempts) || attempts <= 0) return 0
  if (!Number.isFinite(expectedAttempts) || expectedAttempts <= 0) return 0
  // Exact geometric: P(at least one match in k attempts) = 1 - (1 - p)^k
  // Stable form: -expm1(k * log1p(-p))
  const value = -Math.expm1(attempts * Math.log1p(-1 / expectedAttempts))
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

export function attemptsForOdds(targetOdds, expectedAttempts) {
  if (!Number.isFinite(targetOdds) || targetOdds <= 0) return 0
  if (targetOdds >= 1) return Infinity
  if (!Number.isFinite(expectedAttempts) || expectedAttempts <= 0) return Infinity
  // Inverse of cumulative odds: k = log1p(-q) / log1p(-p)
  return Math.log1p(-targetOdds) / Math.log1p(-1 / expectedAttempts)
}

export function getMilestonePosition({ cumulativeAttempts, expectedAttempts }) {
  const cohortFraction = computeCohortFraction(cumulativeAttempts, expectedAttempts)
  const markerPct = Math.max(0, Math.min(1, cohortFraction))
  const crossedMilestones = []
  if (cohortFraction >= 0.5) crossedMilestones.push('median')
  if (cohortFraction >= MEAN_ODDS) crossedMilestones.push('mean')
  if (cohortFraction >= 0.95) crossedMilestones.push('p95')
  if (cohortFraction >= 0.99) crossedMilestones.push('p99')
  if (cohortFraction >= 0.999) crossedMilestones.push('p999')
  return { markerPct, crossedMilestones, cohortFraction }
}

export function getCohortWarning(cohortFraction) {
  if (!Number.isFinite(cohortFraction)) return null
  if (cohortFraction >= 0.999) return 'past-p999'
  if (cohortFraction >= 0.95) return 'past-p95'
  if (cohortFraction >= MEAN_ODDS) return 'past-mean'
  return null
}

export function getMilestoneEtaSeconds({ p, cumulativeAttempts, expectedAttempts, rate }) {
  const target = attemptsForOdds(p, expectedAttempts)
  if (!Number.isFinite(target)) return NaN
  if (cumulativeAttempts >= target) return 0
  if (!Number.isFinite(rate) || rate <= 0) return NaN
  return (target - cumulativeAttempts) / rate
}

export function getThroughputDisplay({ rate, hasStableRate, running }) {
  if (running && !hasStableRate) return 'Measuring…'
  if (rate <= 0) return '—'
  return `${formatNumber(Math.round(rate))} / sec`
}

export function getEtaDisplay({ remainingSeconds, hasStableRate, running }) {
  if (!running) return '—'
  if (!hasStableRate) return 'Measuring…'
  return formatEta(remainingSeconds)
}

export function getMilestoneEtaDisplay({ etaSeconds, hasStableRate, running }) {
  if (!running) return '—'
  if (etaSeconds === 0) return 'Passed'
  if (!hasStableRate) return 'Measuring…'
  if (!Number.isFinite(etaSeconds) || etaSeconds < 0) return '—'
  return formatEta(etaSeconds)
}

export function getAverageThroughputDisplay({ averageRate, totalAttempts, elapsedSec }) {
  if (averageRate <= 0 || elapsedSec <= 0 || totalAttempts <= 0) return '—'
  return `${formatNumber(Math.round(averageRate))} / sec`
}
