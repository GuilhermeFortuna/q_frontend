import { mockStrategies } from '@/mocks/data'
import type { CustomStrategy, StrategiesResponse, StrategyInfo } from '@/types/strategies'

const baseMaCrossover = mockStrategies.strategies.find((entry) => entry.name === 'MACrossover')!

export const mockMaCrossoverWithExits: StrategyInfo = {
  ...baseMaCrossover,
  name: 'MACrossoverWithExits',
  label: 'MA Crossover With Exits',
  params: [
    ...baseMaCrossover.params,
    {
      name: 'stop_loss_pct',
      label: 'Stop Loss %',
      type: 'float',
      default: 0.01,
      min: 0,
      max: 0.1,
      step: 0.001,
      exit_group: 'stop_loss',
    },
    {
      name: 'trailing_stop_pct',
      label: 'Trailing Stop %',
      type: 'float',
      default: 0.015,
      min: 0,
      max: 0.1,
      step: 0.001,
      exit_group: 'trailing',
    },
  ],
}

export const mockOptimizeCustomStrategy: StrategyInfo = {
  name: 'MyCustomMA',
  label: 'MyCustomMA',
  description: 'Custom MA crossover with exit rules',
  category: 'trend',
  thesis: baseMaCrossover.thesis,
  strong_in: baseMaCrossover.strong_in,
  weak_in: baseMaCrossover.weak_in,
  params: [
    ...baseMaCrossover.params,
    {
      name: 'stop_loss_pct',
      label: 'Stop Loss %',
      type: 'float',
      default: 0.01,
      min: 0,
      max: 0.1,
      step: 0.001,
      exit_group: 'stop_loss',
    },
    {
      name: 'trailing_stop_pct',
      label: 'Trailing Stop %',
      type: 'float',
      default: 0.015,
      min: 0,
      max: 0.1,
      step: 0.001,
      exit_group: 'trailing',
    },
  ],
}

export const mockOptimizeCustomSaved: CustomStrategy = {
  name: 'MyCustomMA',
  base_strategy: 'MACrossoverWithExits',
  description: 'Custom MA crossover with exit rules',
  parameters: {
    short_period: 20,
    long_period: 100,
    short_ma_type: 'ema',
    long_ma_type: 'sma',
    threshold: 0,
    stop_loss_pct: 0,
    trailing_stop_pct: 0.015,
  },
}

export function strategiesWithCustomCustom(): StrategiesResponse {
  return {
    strategies: [
      ...mockStrategies.strategies,
      mockMaCrossoverWithExits,
      mockOptimizeCustomStrategy,
    ],
  }
}
