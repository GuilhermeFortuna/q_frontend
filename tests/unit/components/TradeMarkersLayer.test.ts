import { describe, expect, it } from 'vitest'

import { createBarTimestampLookup } from '@/components/backtests/TradeMarkersLayer'
import type { OhlcvBar } from '@/types/api'

function bar(timestamp: string): OhlcvBar {
  return { timestamp, open: 1, high: 1, low: 1, close: 1, volume: 0 } as OhlcvBar
}

const bars = [bar('2024-01-02T10:00:00Z'), bar('2024-01-02T10:10:00Z'), bar('2024-01-02T10:20:00Z')]

describe('createBarTimestampLookup', () => {
  it('matches exact bar timestamps', () => {
    const findBar = createBarTimestampLookup(bars)
    expect(findBar('2024-01-02T10:10:00Z')).toBe('2024-01-02T10:10:00Z')
  })

  it('returns the nearest bar, preferring the earlier one on a tie', () => {
    const findBar = createBarTimestampLookup(bars)
    expect(findBar('2024-01-02T10:03:00Z')).toBe('2024-01-02T10:00:00Z')
    expect(findBar('2024-01-02T10:07:00Z')).toBe('2024-01-02T10:10:00Z')
    expect(findBar('2024-01-02T10:15:00Z')).toBe('2024-01-02T10:10:00Z')
  })

  it('clamps trades outside the bar range to the first or last bar', () => {
    const findBar = createBarTimestampLookup(bars)
    expect(findBar('2024-01-01T00:00:00Z')).toBe('2024-01-02T10:00:00Z')
    expect(findBar('2024-01-03T00:00:00Z')).toBe('2024-01-02T10:20:00Z')
  })

  it('compares instants across timezone offsets and unsorted input', () => {
    const findBar = createBarTimestampLookup([bars[2], bars[0], bars[1]])
    expect(findBar('2024-01-02T07:11:00-03:00')).toBe('2024-01-02T10:10:00Z')
  })

  it('returns null without bars or for an unparseable trade time', () => {
    expect(createBarTimestampLookup([])('2024-01-02T10:00:00Z')).toBeNull()
    expect(createBarTimestampLookup(bars)('not a date')).toBeNull()
  })
})
