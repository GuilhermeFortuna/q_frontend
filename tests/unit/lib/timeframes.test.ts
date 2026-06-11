import { describe, expect, it } from 'vitest'

import {
  formatCrosshairLabel,
  formatTimeAxisLabel,
  toApiTimeframe,
  timeframeToMs,
  isIntradayTimeframe,
} from '@/lib/market/timeframes'

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

  it('formats axis labels with Brasília time for intraday', () => {
    const ts = '2026-01-15T14:30:45.000Z'
    expect(formatTimeAxisLabel(ts, '1m')).toBe('11:30')
    expect(formatTimeAxisLabel(ts, '1D')).toBe('2026/01/15')
  })

  it('formats crosshair labels with Brasília date and time for intraday', () => {
    const ts = '2026-01-15T14:30:45.000Z'
    expect(formatCrosshairLabel(ts, '1m')).toBe('2026/01/15 11:30:45')
    expect(formatCrosshairLabel(ts, '1D')).toBe('2026/01/15')
  })
})
