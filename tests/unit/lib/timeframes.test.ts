import { describe, expect, it } from 'vitest'

import { toApiTimeframe, timeframeToMs, isIntradayTimeframe } from '@/lib/market/timeframes'

describe('timeframes', () => {
  it('maps UI labels to MT5 codes', () => {
    expect(toApiTimeframe('1m')).toBe('M1')
    expect(toApiTimeframe('1H')).toBe('H1')
    expect(toApiTimeframe('1D')).toBe('D1')
  })

  it('returns bar duration in ms', () => {
    expect(timeframeToMs('1m')).toBe(60_000)
    expect(timeframeToMs('1D')).toBe(24 * 60 * 60_000)
  })

  it('detects intraday timeframes', () => {
    expect(isIntradayTimeframe('1m')).toBe(true)
    expect(isIntradayTimeframe('1D')).toBe(false)
  })
})
