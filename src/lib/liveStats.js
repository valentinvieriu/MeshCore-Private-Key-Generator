import { expectedAttemptsForHexLength, formatEta, formatNumber } from './crypto'

const RATE_STABILIZE_MS = 500

export function computeSearchMetrics({ totalAttempts, elapsedMs, prefixHexLength }) {
  const safeElapsedMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0
  const elapsedSec = safeElapsedMs / 1000
  const hasStableRate = safeElapsedMs > RATE_STABILIZE_MS
  const rate = hasStableRate && elapsedSec > 0 ? totalAttempts / elapsedSec : 0
  const expectedAttempts = expectedAttemptsForHexLength(prefixHexLength || 1)
  const findProbability = 1 - Math.exp(-totalAttempts / expectedAttempts)
  const medianAttempts = Math.ceil(expectedAttempts * Math.LN2)
  const remainingAttempts = Math.max(0, medianAttempts - totalAttempts)
  const remainingSeconds = rate > 0 ? remainingAttempts / rate : NaN
  const averageRate = elapsedSec > 0 ? totalAttempts / elapsedSec : 0

  return {
    averageRate,
    elapsedSec,
    expectedAttempts,
    findProbability,
    hasStableRate,
    medianAttempts,
    rate,
    remainingAttempts,
    remainingSeconds,
  }
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

export function getAverageThroughputDisplay({ averageRate, totalAttempts, elapsedSec }) {
  if (averageRate <= 0 || elapsedSec <= 0 || totalAttempts <= 0) return '—'
  return `${formatNumber(Math.round(averageRate))} / sec`
}
