import { describe, expect, it } from 'vitest'

import { combineOhlcvAvailableRanges, toStorageDateInputs } from '@/lib/backtesting/dateRange'
import type { OhlcvAvailableRange } from '@/types/api'

describe('combineOhlcvAvailableRanges', () => {
  it('returns null for an empty list', () => {
    expect(combineOhlcvAvailableRanges([])).toBeNull()
  })

  it('merges multiple ranges into the earliest start and latest end', () => {
    const ranges: OhlcvAvailableRange[] = [
      {
        symbol: 'PETR4',
        timeframe: 'D1',
        start: '2020-01-01T00:00:00',
        end: '2026-01-01T00:00:00',
        bar_count: 1000,
      },
      {
        symbol: 'PETR4',
        timeframe: 'H1',
        start: '2023-06-01T00:00:00',
        end: '2026-06-01T00:00:00',
        bar_count: 5000,
      },
    ]

    expect(combineOhlcvAvailableRanges(ranges)).toEqual({
      start: '2020-01-01T00:00:00',
      end: '2026-06-01T00:00:00',
    })
  })
})

describe('toStorageDateInputs', () => {
  it('maps ISO timestamps to date input values', () => {
    expect(toStorageDateInputs('2020-01-01T12:00:00', '2026-06-07T18:30:00')).toEqual({
      start: '2020-01-01',
      end: '2026-06-07',
    })
  })
})
