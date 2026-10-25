import { describe, expect, it } from 'vitest'

import {
  formatCurrency,
  formatExitReason,
  formatExitResolution,
  formatSignedCurrency,
} from '@/components/backtests/chartUtils'

describe('chartUtils currency formatting', () => {
  it('formats large values with thousands separators', () => {
    expect(formatCurrency(1884703.5)).toBe('1,884,703.50')
  })

  it('formats signed currency with explicit sign', () => {
    expect(formatSignedCurrency(1884703.5)).toBe('+1,884,703.50')
    expect(formatSignedCurrency(-2500)).toBe('-2,500.00')
    expect(formatSignedCurrency(0)).toBe('0.00')
  })

  it('formats backend exit rule ids for trade chart labels', () => {
    expect(formatExitReason('fixed_sl')).toBe('Fixed Stop Loss')
    expect(formatExitReason('atr_sl')).toBe('ATR Stop Loss')
    expect(formatExitReason('fixed_tp')).toBe('Fixed Take Profit')
    expect(formatExitReason('atr_tp')).toBe('ATR Take Profit')
    expect(formatExitReason('chandelier')).toBe('Chandelier Exit')
    expect(formatExitReason('breakeven')).toBe('Breakeven Stop')
    expect(formatExitReason('psar')).toBe('Parabolic SAR')
    expect(formatExitReason('profit_target_ratchet')).toBe('Profit Target Ratchet')
    expect(formatExitReason('time_stop')).toBe('Time Stop')
    expect(formatExitReason('donchian_stop')).toBe('Donchian Stop')
  })
})

describe('formatExitReason for strategy reasons', () => {
  it('shows strategy-supplied reasons verbatim, including lookalike codes', () => {
    expect(formatExitReason('VWAP reclaim')).toBe('VWAP reclaim')
    expect(formatExitReason('momentum_faded')).toBe('momentum_faded')
    expect(formatExitReason('signal')).toBe('signal')
    expect(formatExitReason('tp')).toBe('tp')
  })

  it('labels the engine codes that stored runs and q_core emit', () => {
    expect(formatExitReason('SIGNAL')).toBe('Signal Exit')
    expect(formatExitReason('STOP_LOSS')).toBe('Fixed Stop Loss')
    expect(formatExitReason('TAKE_PROFIT')).toBe('Fixed Take Profit')
    expect(formatExitReason('END_OF_DAY')).toBe('End of Day')
    expect(formatExitReason('FORCE_CLOSE')).toBe('Force Close')
    expect(formatExitReason('trailing')).toBe('Trailing Stop')
  })
})

describe('chartUtils exit resolution', () => {
  it('labels only substituted exits as approximate', () => {
    expect(formatExitResolution('minute')).toBe('Approximate: one-minute bar')
    expect(formatExitResolution('candle')).toBe('Approximate: candle prices')
    expect(formatExitResolution('tick')).toBeNull()
    expect(formatExitResolution(null)).toBeNull()
    expect(formatExitResolution(undefined)).toBeNull()
  })
})
