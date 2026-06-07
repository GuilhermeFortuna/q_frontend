import { describe, expect, it } from 'vitest'

import {
  computeBackfillWindow,
  getBackgroundPrefetchChunks,
  getLoadingStrategy,
  mergeOhlcvBars,
} from '@/lib/market/ohlcvLoading'
import type { OhlcvBar } from '@/types/api'

function bar(timestamp: string, close = 100): OhlcvBar {
  return {
    timestamp,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: 1000,
  }
}

describe('getLoadingStrategy', () => {
  it('returns full for daily', () => {
    expect(getLoadingStrategy('1D')).toBe('full')
    expect(getLoadingStrategy('D1')).toBe('full')
  })

  it('returns progressive for intraday', () => {
    expect(getLoadingStrategy('1m')).toBe('progressive')
    expect(getLoadingStrategy('1H')).toBe('progressive')
  })
})

describe('getBackgroundPrefetchChunks', () => {
  it('prefetches fewer chunks on 1m', () => {
    expect(getBackgroundPrefetchChunks('1m')).toBe(1)
    expect(getBackgroundPrefetchChunks('1H')).toBe(2)
  })
})

describe('mergeOhlcvBars', () => {
  it('prepends older bars and sorts chronologically', () => {
    const existing = [bar('2024-06-02T00:00:00.000Z'), bar('2024-06-03T00:00:00.000Z')]
    const older = [bar('2024-06-01T00:00:00.000Z')]

    const merged = mergeOhlcvBars(existing, older)

    expect(merged.map((b) => b.timestamp)).toEqual([
      '2024-06-01T00:00:00.000Z',
      '2024-06-02T00:00:00.000Z',
      '2024-06-03T00:00:00.000Z',
    ])
  })

  it('dedupes overlapping timestamps', () => {
    const existing = [bar('2024-06-02T00:00:00.000Z', 101)]
    const older = [bar('2024-06-02T00:00:00.000Z', 99)]

    const merged = mergeOhlcvBars(existing, older)

    expect(merged).toHaveLength(1)
    expect(merged[0].close).toBe(101)
  })
})

describe('computeBackfillWindow', () => {
  it('returns null when already at earliest bar', () => {
    const window = computeBackfillWindow(
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
      '1H',
    )
    expect(window).toBeNull()
  })

  it('returns an older window ending before the oldest loaded bar', () => {
    const window = computeBackfillWindow(
      '2024-06-01T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
      '1H',
    )

    expect(window).not.toBeNull()
    expect(new Date(window!.end).getTime()).toBeLessThan(
      new Date('2024-06-01T00:00:00.000Z').getTime(),
    )
    expect(new Date(window!.start).getTime()).toBeGreaterThanOrEqual(
      new Date('2024-01-01T00:00:00.000Z').getTime(),
    )
  })
})
