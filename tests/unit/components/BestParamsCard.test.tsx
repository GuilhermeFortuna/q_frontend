import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BestParamsCard } from '@/components/optimize/BestParamsCard'
import type { OptimizationBacktestConfig, OptimizationResults } from '@/types/optimization'

const backtest: OptimizationBacktestConfig = {
  symbol: 'PETR4',
  start: '2024-01-01',
  end: '2024-06-01',
  initial_capital: 100000,
  point_value: 1,
  strategy: 'MACrossover',
  engine: 'candle',
}

describe('BestParamsCard', () => {
  it('formats multi-objective trial values as percentages', () => {
    const results: OptimizationResults = {
      study_id: 'study-multi',
      objective_mode: 'multi_objective_return_drawdown',
      is_multi_objective: true,
      best_params: {},
      best_trial: {
        number: 2,
        params: {},
        values: [0.25, 0.05],
        state: 'COMPLETE',
        user_attrs: {
          status: 'complete',
          strategy_params: { short_period: 12 },
          risk_params: { quantity: 2 },
        },
      },
      trials: [],
      pareto_trials: [],
      failures: [],
    }

    render(<BestParamsCard results={results} backtest={backtest} onLoad={vi.fn()} />)

    expect(screen.getByText(/Objectives:/)).toBeInTheDocument()
    expect(screen.getByText('Return: 25.00%, Drawdown: 5.00%')).toBeInTheDocument()
  })
})
