import { describe, expect, it } from 'vitest'

import {
  buildBacktestRequestFromTrial,
  buildPositionSizingFromRiskParams,
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

describe('buildBacktestRequestFromTrial', () => {
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
    })
  })

  it('handles missing user_attrs gracefully', () => {
    const result = buildBacktestRequestFromTrial(trial({}), backtest)
    expect(result.strategy_params).toEqual({})
    expect(result.position_sizing).toBeUndefined()
  })
})
