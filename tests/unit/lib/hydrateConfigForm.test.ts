import { describe, expect, it } from 'vitest'

import { hydrateOptimizeFormFromConfig } from '@/lib/optimize/hydrateConfigForm'
import { mockStrategies } from '@/mocks/data'
import type { OptimizationConfig } from '@/types/optimization'

const sampleConfig: OptimizationConfig = {
  study: {
    name: 'WIN$ MA sweep',
    n_trials: 30,
    seed: 7,
    sampler: 'tpe',
    pruner: 'median',
    continue_on_trial_error: true,
  },
  objective: { mode: 'maximize_return_drawdown' },
  backtest: {
    symbol: 'WIN$',
    timeframe: 'M5',
    start: '2025-01-01T00:00:00.000Z',
    end: '2025-06-01T00:00:00.000Z',
    initial_capital: 100000,
    point_value: 0.2,
    strategy: 'MACrossover',
  },
  search_space: {
    strategy_params: {
      short_period: { type: 'int', low: 5, high: 30 },
      long_period: { type: 'int', low: 31, high: 100 },
      threshold: { type: 'float', low: 0.1, high: 2.5 },
      short_ma_type: { type: 'categorical', choices: ['sma', 'ema'] },
      long_ma_type: { type: 'categorical', choices: ['sma'] },
    },
    risk_params: {
      type: { type: 'categorical', choices: ['fixed_quantity'] },
      quantity: { type: 'float', low: 1, high: 3 },
    },
  },
}

describe('hydrateOptimizeFormFromConfig', () => {
  it('maps optimization config into form state', () => {
    const hydrated = hydrateOptimizeFormFromConfig(sampleConfig, mockStrategies.strategies)

    expect(hydrated.symbol).toBe('WIN$')
    expect(hydrated.timeframe).toBe('M5')
    expect(hydrated.capital).toBe(100000)
    expect(hydrated.nTrials).toBe(30)
    expect(hydrated.seed).toBe(7)
    expect(hydrated.pruner).toBe('median')
    expect(hydrated.continueOnTrialError).toBe(true)
    expect(hydrated.strategy).toBe('MACrossover')
    const primarySlot = hydrated.entries[0]?.slotId
    const entrySpace = primarySlot ? hydrated.entrySearchSpaces[primarySlot] : {}
    expect(entrySpace.short_period).toEqual({
      kind: 'numeric',
      low: 5,
      high: 30,
      step: 1,
    })
    expect(entrySpace.short_ma_type).toEqual({
      kind: 'categorical',
      choices: ['sma', 'ema'],
    })
    expect(hydrated.riskMode).toBe('fixed_quantity')
    expect(hydrated.qtyHigh).toBe(3)
    expect(hydrated.engine).toBe('candle')
    expect(hydrated.displayTimeframe).toBe('M1')
    expect(hydrated.tickFlags).toBe('all')
    expect(hydrated.costFields).toEqual({ costPerContract: 0, costBps: 0 })
  })

  it('hydrates costs and inverse-volatility risk params', () => {
    const config: OptimizationConfig = {
      ...sampleConfig,
      backtest: {
        ...sampleConfig.backtest,
        costs: { cost_per_contract: 4, cost_bps: 2.5 },
      },
      search_space: {
        ...sampleConfig.search_space,
        risk_params: {
          type: { type: 'categorical', choices: ['inverse_volatility'] },
          target_volatility_pct: { type: 'float', low: 8, high: 12 },
          min_contracts: { type: 'int', low: 0, high: 1 },
          max_contracts: { type: 'int', low: 5, high: 5 },
        },
      },
    }

    const hydrated = hydrateOptimizeFormFromConfig(config, mockStrategies.strategies)

    expect(hydrated.costFields).toEqual({ costPerContract: 4, costBps: 2.5 })
    expect(hydrated.riskMode).toBe('inverse_volatility')
    expect(hydrated.targetVolLow).toBe(8)
    expect(hydrated.targetVolHigh).toBe(12)
    expect(hydrated.inverseMinContractsLow).toBe(0)
    expect(hydrated.inverseMinContractsHigh).toBe(1)
    expect(hydrated.inverseMaxContractsInput).toBe('5')
  })
})
