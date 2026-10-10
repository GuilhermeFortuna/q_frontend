import { describe, expect, it } from 'vitest'

import {
  CHART_TIMEFRAMES,
  RESEARCH_CANDLE_TIMEFRAME_OPTIONS,
  timeframeToMs,
  toApiTimeframe,
} from '@/lib/market/timeframes'
import { parseTimeframeInput } from '@/lib/market/timeframeCommands'
import { getLoadingStrategy, getBackfillWindowDays } from '@/lib/market/ohlcvLoading'
import { STORAGE_TIMEFRAME_OPTIONS } from '@/types/storage'
import { DISPLAY_TIMEFRAME_OPTIONS as BACKTEST_DISPLAY_TIMEFRAME_OPTIONS } from '@/lib/backtesting/useBacktestConfig'
import { DISPLAY_TIMEFRAME_OPTIONS as OPTIMIZE_DISPLAY_TIMEFRAME_OPTIONS } from '@/lib/optimize/useOptimizeConfig'

describe('market timeframes', () => {
  it('maps the 10 minute chart interval to the API timeframe', () => {
    expect(CHART_TIMEFRAMES).toContain('10m')
    expect(toApiTimeframe('10m')).toBe('M10')
    expect(toApiTimeframe('M10')).toBe('M10')
  })

  it('uses a ten minute bar duration', () => {
    expect(timeframeToMs('M10')).toBe(10 * 60_000)
  })

  it('offers ten minute bars for storage and chart commands', () => {
    expect(RESEARCH_CANDLE_TIMEFRAME_OPTIONS).toContainEqual({ value: 'M10', label: '10 Minutes' })
    expect(STORAGE_TIMEFRAME_OPTIONS).toContain('M10')
    expect(BACKTEST_DISPLAY_TIMEFRAME_OPTIONS).toContain('M10')
    expect(OPTIMIZE_DISPLAY_TIMEFRAME_OPTIONS).toContain('M10')
    expect(parseTimeframeInput('10m')).toEqual({ label: 'Switch to 10 Minutes', value: '10m' })
    expect(parseTimeframeInput('10')).toEqual({ label: 'Switch to 10 Minutes', value: '10m' })
  })
})

describe('multi-hour research timeframes', () => {
  it.each([2, 4])('offers and loads %i hour bars consistently', (hours) => {
    const code = `H${hours}`
    expect(RESEARCH_CANDLE_TIMEFRAME_OPTIONS).toContainEqual({
      value: code,
      label: `${hours} Hours`,
    })
    expect(CHART_TIMEFRAMES).toContain(`${hours}H`)
    expect(STORAGE_TIMEFRAME_OPTIONS).toContain(code)
    expect(BACKTEST_DISPLAY_TIMEFRAME_OPTIONS).toContain(code)
    expect(OPTIMIZE_DISPLAY_TIMEFRAME_OPTIONS).toContain(code)
    expect(toApiTimeframe(`${hours}h`)).toBe(code)
    expect(toApiTimeframe(code)).toBe(code)
    expect(timeframeToMs(code)).toBe(hours * 60 * 60_000)
    expect(getLoadingStrategy(code)).toBe('progressive')
    expect(getBackfillWindowDays(code)).toBe(180)
    for (const input of [`${hours}h`, `${hours} hours`, `${hours * 60}m`, `${hours * 60}`]) {
      expect(parseTimeframeInput(input)).toEqual({
        label: `Switch to ${hours} Hours`,
        value: `${hours}H`,
      })
    }
  })
})
