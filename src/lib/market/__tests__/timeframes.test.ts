import { describe, expect, it } from 'vitest'

import {
  CHART_TIMEFRAMES,
  RESEARCH_CANDLE_TIMEFRAME_OPTIONS,
  timeframeToMs,
  toApiTimeframe,
} from '@/lib/market/timeframes'
import { parseTimeframeInput } from '@/lib/market/timeframeCommands'
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
