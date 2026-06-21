import { describe, expect, it } from 'vitest'

import { defaultTransactionCostFields } from '@/lib/backtesting/transactionCosts'
import {
  buildOptimizationConfig,
  type OptimizeConfigFields,
} from '@/lib/optimize/useOptimizeConfig'
import { buildStrategyParamsSearchSpacePayload } from '@/lib/optimize/exitSearchSpace'
import { defaultSearchSpaceFromSpecs } from '@/lib/strategies/strategyParams'
import { withResolvedCustomStrategyParams } from '@/lib/strategies/resolveCustomStrategyParams'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'
import type { StrategyInfo } from '@/types/strategies'
import {
  mockOptimizeCustomSaved,
  mockOptimizeCustomStrategy,
  strategiesWithCustomCustom,
} from '../../fixtures/optimizeCustomStrategyFixtures'

function baseOptimizeFields(
  strategySearchSpace: OptimizeConfigFields['strategySearchSpace'],
): OptimizeConfigFields {
  return {
    symbol: 'PETR4',
    timeframe: 'D1',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-06-01'),
    capital: 100000,
    pointValue: 1,
    dayTrade: false,
    dayTradeStartTime: '09:00',
    dayTradeEndTime: '16:00',
    dayTradeCloseTime: '17:00',
    engine: 'candle',
    displayTimeframe: 'M1',
    tickFlags: 'all',
    objective: 'maximize_return_drawdown',
    sampler: 'tpe',
    nTrials: 30,
    seed: 42,
    pruner: 'none',
    continueOnTrialError: false,
    maxWorkersInput: '',
    strategy: mockOptimizeCustomStrategy.name,
    strategySearchSpace,
    riskMode: 'fixed_quantity',
    qtyLow: 1,
    qtyHigh: 3,
    marginLow: 1000,
    marginHigh: 10000,
    minContractsLow: 1,
    minContractsHigh: 3,
    targetVolLow: 5,
    targetVolHigh: 15,
    inverseMinContractsLow: 0,
    inverseMinContractsHigh: 2,
    inverseMaxContractsInput: '',
    costFields: defaultTransactionCostFields(),
  }
}

const customExitRules = [
  {
    id: 'fixed_sl',
    label: 'Fixed Stop Loss',
    description: 'Fixed stop.',
    exit_group: 'stop_loss' as const,
    enable_param: 'stop_loss_pct',
    enable_value: 0.02,
    param_names: ['stop_loss_pct'],
    required_param_names: [],
  },
  {
    id: 'trailing_pct',
    label: 'Trailing Stop',
    description: 'Trailing stop.',
    exit_group: 'trailing' as const,
    enable_param: 'trailing_stop_pct',
    enable_value: 0.015,
    param_names: ['trailing_stop_pct'],
    required_param_names: [],
  },
]

describe('useOptimizeConfig custom strategies', () => {
  it('buildOptimizationConfig uses the custom strategy name and sweeps candidate exits from zero', () => {
    const strategies = strategiesWithCustomCustom().strategies
    const selected = withResolvedCustomStrategyParams(mockOptimizeCustomStrategy, strategies, [
      mockOptimizeCustomSaved,
    ])
    const searchSpace = defaultSearchSpaceFromSpecs(selected.params)
    const { entryParamSpecs, exitParamSpecs } = partitionStrategyParamSpecs(selected.params)

    expect(entryParamSpecs.length).toBeGreaterThan(0)
    expect(exitParamSpecs.length).toBeGreaterThan(0)

    const config = buildOptimizationConfig(baseOptimizeFields(searchSpace), selected.name)
    config.search_space.strategy_params = buildStrategyParamsSearchSpacePayload(
      searchSpace,
      entryParamSpecs,
      exitParamSpecs,
      customExitRules,
      new Set(['fixed_sl', 'trailing_pct']),
      [],
    )

    expect(config.backtest.strategy).toBe('MyCustomMA')
    expect(config.search_space.strategy_params).toMatchObject({
      short_period: expect.objectContaining({ type: 'int' }),
      stop_loss_pct: { type: 'float', low: 0, high: 0.1, step: 0.001 },
      trailing_stop_pct: { type: 'float', low: 0, high: 0.1, step: 0.001 },
    })
    const stopLoss = config.search_space.strategy_params.stop_loss_pct
    const trailingStop = config.search_space.strategy_params.trailing_stop_pct
    if (stopLoss?.type === 'float') {
      expect(stopLoss.low).not.toBe(stopLoss.high)
    }
    if (trailingStop?.type === 'float') {
      expect(trailingStop.low).not.toBe(trailingStop.high)
    }
  })

  it('resolves sparse custom params before building search space defaults', () => {
    const strategies = [...strategiesWithCustomCustom().strategies]
    const sparseCustom: StrategyInfo = {
      name: 'MyCustomMA',
      label: 'MyCustomMA',
      description: 'Sparse custom',
      params: [
        { name: 'short_period', label: 'Short Period', type: 'int', default: 20 },
        { name: 'long_period', label: 'Long Period', type: 'int', default: 100 },
      ],
    }
    const resolved = withResolvedCustomStrategyParams(sparseCustom, strategies, [
      mockOptimizeCustomSaved,
    ])
    const searchSpace = defaultSearchSpaceFromSpecs(resolved.params)

    expect(searchSpace.trailing_stop_pct).toBeDefined()
    expect(searchSpace.short_period).toBeDefined()
  })
})
