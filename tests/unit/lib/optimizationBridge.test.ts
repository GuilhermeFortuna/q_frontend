import { describe, expect, it } from 'vitest'

import {
  buildBacktestRequestFromTrial,
  buildPositionSizingFromRiskParams,
  entriesFromTrialParams,
  exitParamsFromTrialParams,
} from '@/lib/optimization/bridge'
import type { OptimizationBacktestConfig, OptimizationTrial } from '@/types/optimization'

const backtest: OptimizationBacktestConfig = {
  symbol: 'PETR4',
  timeframe: 'D1',
  start: '2024-01-01T00:00:00.000Z',
  end: '2025-01-01T00:00:00.000Z',
  initial_capital: 100000,
  point_value: 10,
  strategy: 'MACrossover',
}

function trial(userAttrs: OptimizationTrial['user_attrs']): OptimizationTrial {
  return {
    number: 7,
    params: {},
    values: [1.5],
    state: 'COMPLETE',
    user_attrs: userAttrs,
  }
}

describe('buildPositionSizingFromRiskParams', () => {
  it('maps fixed_quantity', () => {
    expect(buildPositionSizingFromRiskParams({ type: 'fixed_quantity', quantity: 2.5 })).toEqual({
      type: 'fixed_quantity',
      quantity: 2.5,
    })
  })

  it('maps fixed_safety_margin with null max', () => {
    expect(
      buildPositionSizingFromRiskParams({
        type: 'fixed_safety_margin',
        safety_margin_per_contract: 4000,
        min_contracts: 2,
      }),
    ).toEqual({
      type: 'fixed_safety_margin',
      safety_margin_per_contract: 4000,
      min_contracts: 2,
      max_contracts: null,
    })
  })

  it('returns undefined for unknown type', () => {
    expect(buildPositionSizingFromRiskParams({})).toBeUndefined()
  })
})

describe('entriesFromTrialParams', () => {
  it('overlays each slot prefix on its template and ignores other keys', () => {
    expect(
      entriesFromTrialParams(
        { e0__short_period: 7, e1__period: 9, e10__period: 3, stop_loss_pct: 0.02 },
        [
          { strategy: 'MACrossover', params: { short_period: 50, short_ma_type: 'ema' } },
          { strategy: 'RSIMeanReversion', params: { period: 14 } },
        ],
      ),
    ).toEqual([
      { strategy: 'MACrossover', params: { short_period: 7, short_ma_type: 'ema' } },
      { strategy: 'RSIMeanReversion', params: { period: 9 } },
    ])
  })
})

describe('exitParamsFromTrialParams', () => {
  it('overlays un-namespaced trial params on the exit template', () => {
    expect(
      exitParamsFromTrialParams(
        { e0__short_period: 7, stop_loss_pct: 0.02 },
        { stop_loss_pct: 0.01, atr_period: 14 },
      ),
    ).toEqual({ stop_loss_pct: 0.02, atr_period: 14 })
  })
})

describe('buildBacktestRequestFromTrial', () => {
  it('rebuilds entries, manager and shared exits for a multi-entry study', () => {
    const result = buildBacktestRequestFromTrial(
      trial({
        strategy_params: {
          e0__short_period: 7,
          e0__long_period: 30,
          e1__period: 9,
          stop_loss_pct: 0.02,
          trailing_stop_pct: 0,
        },
        manager_params: { vote_threshold: 2 },
        risk_params: { type: 'fixed_quantity', quantity: 3 },
      }),
      {
        ...backtest,
        entries: [
          { strategy: 'MACrossover', params: { short_period: 50, short_ma_type: 'ema' } },
          { strategy: 'RSIMeanReversion', params: { period: 14, oversold: 25 } },
        ],
        entry_manager: { kind: 'majority', params: { vote_threshold: 1 } },
        exit_params: {},
      },
    )

    const exitParams = { stop_loss_pct: 0.02, trailing_stop_pct: 0 }
    expect(result.strategy).toBe('MACrossover')
    expect(result.entries).toEqual([
      {
        strategy: 'MACrossover',
        params: { short_period: 7, long_period: 30, short_ma_type: 'ema' },
      },
      { strategy: 'RSIMeanReversion', params: { period: 9, oversold: 25 } },
    ])
    expect(result.entry_manager).toEqual({ kind: 'majority', params: { vote_threshold: 2 } })
    expect(result.exit_params).toEqual(exitParams)
    expect(result.strategy_params).toEqual(exitParams)
  })

  it('keeps the flat single-strategy payload when the study has no entries', () => {
    const result = buildBacktestRequestFromTrial(
      trial({ strategy_params: { short_period: 10, stop_loss_pct: 0.02 } }),
      backtest,
    )

    expect(result.strategy_params).toEqual({ short_period: 10, stop_loss_pct: 0.02 })
    expect(result).not.toHaveProperty('entries')
    expect(result).not.toHaveProperty('entry_manager')
    expect(result).not.toHaveProperty('exit_params')
  })

  it('carries over backtest window and trial params', () => {
    const result = buildBacktestRequestFromTrial(
      trial({
        strategy_params: { short_period: 10, long_period: 50, threshold: 0.5 },
        risk_params: { type: 'fixed_quantity', quantity: 3 },
      }),
      backtest,
    )

    expect(result).toEqual({
      symbol: 'PETR4',
      timeframe: 'D1',
      start: '2024-01-01T00:00:00.000Z',
      end: '2025-01-01T00:00:00.000Z',
      initial_capital: 100000,
      point_value: 10,
      strategy: 'MACrossover',
      strategy_params: { short_period: 10, long_period: 50, threshold: 0.5 },
      position_sizing: { type: 'fixed_quantity', quantity: 3 },
      engine: 'candle',
    })
  })

  it('handles missing user_attrs gracefully', () => {
    const result = buildBacktestRequestFromTrial(trial({}), backtest)
    expect(result.strategy_params).toEqual({})
    expect(result.position_sizing).toBeUndefined()
  })

  it('carries over engine, display_timeframe, tick_flags, and day trade parameters', () => {
    const fullBacktestConfig = {
      ...backtest,
      engine: 'tick' as const,
      display_timeframe: 'M5',
      tick_flags: 'trade' as const,
      day_trade: true,
      day_trade_start_time: '10:00',
      day_trade_end_time: '15:00',
      day_trade_close_time: '16:00',
    }
    const result = buildBacktestRequestFromTrial(
      trial({
        strategy_params: { short_period: 10, long_period: 50, threshold: 0.5 },
        risk_params: { type: 'fixed_quantity', quantity: 3 },
      }),
      fullBacktestConfig,
    )
    expect(result.engine).toBe('tick')
    expect(result.display_timeframe).toBe('M5')
    expect(result.tick_flags).toBe('trade')
    expect(result.day_trade).toBe(true)
    expect(result.day_trade_start_time).toBe('10:00')
    expect(result.day_trade_end_time).toBe('15:00')
    expect(result.day_trade_close_time).toBe('16:00')
  })
})
