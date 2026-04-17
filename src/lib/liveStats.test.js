import { describe, expect, test } from 'vitest'
import {
  attemptsForOdds,
  computeCohortFraction,
  computeSearchMetrics,
  getAverageThroughputDisplay,
  getCohortWarning,
  getEtaDisplay,
  getMilestoneEtaDisplay,
  getMilestoneEtaSeconds,
  getMilestonePosition,
  getThroughputDisplay,
} from './liveStats'

describe('computeSearchMetrics', () => {
  test('derives stable rate and cohort fraction once elapsed time settles', () => {
    const metrics = computeSearchMetrics({ totalAttempts: 64, elapsedMs: 1000, prefixHexLength: 2 })

    expect(metrics.hasStableRate).toBe(true)
    expect(metrics.rate).toBe(64)
    expect(metrics.cohortFraction).toBeGreaterThan(0.2)
    expect(metrics.cohortFraction).toBeLessThan(0.3)
    expect(metrics.meanAttempts).toBe(256)
  })

  test('keeps rate unstable during the first half second', () => {
    const metrics = computeSearchMetrics({ totalAttempts: 32, elapsedMs: 300, prefixHexLength: 2 })

    expect(metrics.hasStableRate).toBe(false)
    expect(metrics.rate).toBe(0)
  })

  test('uses cumulativeAttempts for cohortFraction when provided', () => {
    const metrics = computeSearchMetrics({
      totalAttempts: 50,
      cumulativeAttempts: 200,
      elapsedMs: 1000,
      prefixHexLength: 2,
    })
    expect(metrics.cohortFraction).toBeGreaterThan(0.5)
  })
})

describe('computeCohortFraction', () => {
  test('returns 0 when attempts is 0', () => {
    expect(computeCohortFraction(0, 256)).toBe(0)
  })

  test('matches the exact geometric formula 1 - (1 - p)^k', () => {
    const expected = 65536
    const k = 10000
    const p = 1 / expected
    const exact = 1 - Math.pow(1 - p, k)
    const actual = computeCohortFraction(k, expected)
    expect(Math.abs(actual - exact)).toBeLessThan(1e-12)
  })

  test('produces ~63.2% odds at the mean', () => {
    const fraction = computeCohortFraction(65536, 65536)
    expect(fraction).toBeGreaterThan(0.63)
    expect(fraction).toBeLessThan(0.633)
  })

  test('clamps to 1 for extremely high attempts and 0 for invalid input', () => {
    expect(computeCohortFraction(1e18, 256)).toBe(1)
    expect(computeCohortFraction(NaN, 256)).toBe(0)
    expect(computeCohortFraction(-5, 256)).toBe(0)
  })
})

describe('attemptsForOdds', () => {
  test('inverse of cohort fraction at 50%, 90%, 99%', () => {
    const expected = 65536
    const a50 = attemptsForOdds(0.5, expected)
    const a90 = attemptsForOdds(0.9, expected)
    const a99 = attemptsForOdds(0.99, expected)

    expect(Math.abs(computeCohortFraction(a50, expected) - 0.5)).toBeLessThan(1e-9)
    expect(Math.abs(computeCohortFraction(a90, expected) - 0.9)).toBeLessThan(1e-9)
    expect(Math.abs(computeCohortFraction(a99, expected) - 0.99)).toBeLessThan(1e-9)
  })

  test('approximates the small-p closed forms', () => {
    const expected = 1_000_000
    expect(attemptsForOdds(0.5, expected)).toBeCloseTo(expected * Math.LN2, -1)
    expect(attemptsForOdds(0.99, expected)).toBeCloseTo(expected * Math.log(100), -1)
  })

  test('returns Infinity for odds >= 1, 0 for odds <= 0', () => {
    expect(attemptsForOdds(1, 256)).toBe(Infinity)
    expect(attemptsForOdds(0, 256)).toBe(0)
  })
})

describe('getMilestonePosition', () => {
  const expected = 65536

  test('marker is monotonic in attempts and clamped to [0, 1]', () => {
    const a = getMilestonePosition({ cumulativeAttempts: 0, expectedAttempts: expected })
    const b = getMilestonePosition({ cumulativeAttempts: 10000, expectedAttempts: expected })
    const c = getMilestonePosition({ cumulativeAttempts: 1e9, expectedAttempts: expected })

    expect(a.markerPct).toBe(0)
    expect(b.markerPct).toBeGreaterThan(a.markerPct)
    expect(c.markerPct).toBeLessThanOrEqual(1)
    expect(c.markerPct).toBeGreaterThan(b.markerPct)
  })

  test('reports crossed milestones at the right thresholds', () => {
    expect(getMilestonePosition({ cumulativeAttempts: 0, expectedAttempts: expected }).crossedMilestones).toEqual([])
    expect(getMilestonePosition({ cumulativeAttempts: attemptsForOdds(0.5, expected), expectedAttempts: expected }).crossedMilestones).toEqual(['median'])
    expect(getMilestonePosition({ cumulativeAttempts: expected, expectedAttempts: expected }).crossedMilestones).toEqual(['median', 'mean'])
    expect(getMilestonePosition({ cumulativeAttempts: attemptsForOdds(0.95, expected), expectedAttempts: expected }).crossedMilestones).toEqual(['median', 'mean', 'p95'])
    expect(getMilestonePosition({ cumulativeAttempts: attemptsForOdds(0.999, expected), expectedAttempts: expected }).crossedMilestones).toEqual(['median', 'mean', 'p95', 'p99', 'p999'])
  })
})

describe('getCohortWarning', () => {
  test('tier transitions', () => {
    expect(getCohortWarning(0.4)).toBe(null)
    expect(getCohortWarning(0.5)).toBe(null)
    expect(getCohortWarning(0.7)).toBe('past-mean')
    expect(getCohortWarning(0.95)).toBe('past-p95')
    expect(getCohortWarning(0.999)).toBe('past-p999')
  })
})

describe('getMilestoneEtaSeconds', () => {
  const expected = 65536

  test('returns 0 once already past the milestone', () => {
    const target = attemptsForOdds(0.5, expected)
    expect(getMilestoneEtaSeconds({ p: 0.5, cumulativeAttempts: target + 1, expectedAttempts: expected, rate: 1000 })).toBe(0)
  })

  test('returns NaN when rate is zero or invalid', () => {
    expect(Number.isNaN(getMilestoneEtaSeconds({ p: 0.5, cumulativeAttempts: 0, expectedAttempts: expected, rate: 0 }))).toBe(true)
    expect(Number.isNaN(getMilestoneEtaSeconds({ p: 0.5, cumulativeAttempts: 0, expectedAttempts: expected, rate: NaN }))).toBe(true)
  })

  test('linear seconds estimate from current throughput', () => {
    const rate = 1000
    const target = attemptsForOdds(0.5, expected)
    const seconds = getMilestoneEtaSeconds({ p: 0.5, cumulativeAttempts: 0, expectedAttempts: expected, rate })
    expect(seconds).toBeCloseTo(target / rate, 6)
  })
})

describe('live stats display helpers', () => {
  test('shows measuring while throughput is still warming up', () => {
    expect(getThroughputDisplay({ rate: 0, hasStableRate: false, running: true })).toBe('Measuring…')
    expect(getEtaDisplay({ remainingSeconds: 10, hasStableRate: false, running: true })).toBe('Measuring…')
  })

  test('formats stable throughput and eta values', () => {
    expect(getThroughputDisplay({ rate: 256, hasStableRate: true, running: true })).toBe('256 / sec')
    expect(getEtaDisplay({ remainingSeconds: 90, hasStableRate: true, running: true })).toBe('2m')
  })

  test('formats average throughput for completed runs', () => {
    expect(getAverageThroughputDisplay({ averageRate: 128, elapsedSec: 1, totalAttempts: 128 })).toBe('128 / sec')
    expect(getAverageThroughputDisplay({ averageRate: 0, elapsedSec: 0, totalAttempts: 0 })).toBe('—')
  })

  test('milestone ETA display states', () => {
    expect(getMilestoneEtaDisplay({ etaSeconds: 30, hasStableRate: true, running: true })).toBe('30s')
    expect(getMilestoneEtaDisplay({ etaSeconds: 0, hasStableRate: true, running: true })).toBe('Passed')
    expect(getMilestoneEtaDisplay({ etaSeconds: 30, hasStableRate: false, running: true })).toBe('Measuring…')
    expect(getMilestoneEtaDisplay({ etaSeconds: 30, hasStableRate: true, running: false })).toBe('—')
    expect(getMilestoneEtaDisplay({ etaSeconds: NaN, hasStableRate: true, running: true })).toBe('—')
  })
})
