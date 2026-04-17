import { describe, expect, test } from 'vitest'
import {
  computeSearchMetrics,
  getAverageThroughputDisplay,
  getEtaDisplay,
  getThroughputDisplay,
} from './liveStats'

describe('computeSearchMetrics', () => {
  test('derives stable rate and remaining time once elapsed time settles', () => {
    const metrics = computeSearchMetrics({ totalAttempts: 64, elapsedMs: 1000, prefixHexLength: 2 })

    expect(metrics.hasStableRate).toBe(true)
    expect(metrics.rate).toBe(64)
    expect(metrics.remainingAttempts).toBeGreaterThan(0)
    expect(metrics.remainingSeconds).toBeGreaterThan(1)
    expect(metrics.findProbability).toBeGreaterThan(0.2)
  })

  test('keeps rate unstable during the first half second', () => {
    const metrics = computeSearchMetrics({ totalAttempts: 32, elapsedMs: 300, prefixHexLength: 2 })

    expect(metrics.hasStableRate).toBe(false)
    expect(metrics.rate).toBe(0)
    expect(Number.isNaN(metrics.remainingSeconds)).toBe(true)
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
})
