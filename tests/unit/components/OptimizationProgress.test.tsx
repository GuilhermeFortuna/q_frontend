import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OptimizationProgress } from '@/components/optimize/OptimizationProgress'
import type { OptimizationStatus } from '@/types/optimization'

const baseStatus: OptimizationStatus = {
  study_id: 'study-1',
  status: 'running',
  completed_trials: 4,
  n_trials: 20,
  best_value: 12.34,
  best_params: {},
  error: null,
}

describe('OptimizationProgress', () => {
  it('renders trial progress without a parallel header by default', () => {
    render(<OptimizationProgress status={baseStatus} onCancel={vi.fn()} cancelling={false} />)

    expect(screen.getByText(/Progress: 4 \/ 20 Trials/i)).toBeInTheDocument()
    expect(screen.queryByText(/in parallel/i)).not.toBeInTheDocument()
  })

  it('does not render parallel header when workers is 1', () => {
    render(
      <OptimizationProgress
        status={{ ...baseStatus, workers: 1 }}
        onCancel={vi.fn()}
        cancelling={false}
      />,
    )

    expect(screen.queryByText(/in parallel/i)).not.toBeInTheDocument()
  })

  it('shows parallel execution header when running across multiple workers', () => {
    render(
      <OptimizationProgress
        status={{ ...baseStatus, workers: 8 }}
        onCancel={vi.fn()}
        cancelling={false}
      />,
    )

    expect(screen.getByText(/Running 20 trials · 8 in parallel/i)).toBeInTheDocument()
    expect(screen.getByText(/Progress: 4 \/ 20 Trials/i)).toBeInTheDocument()
  })

  it('shows scalar best objective for single-objective runs', () => {
    render(<OptimizationProgress status={baseStatus} onCancel={vi.fn()} cancelling={false} />)

    expect(screen.getByText(/Best objective:/i)).toBeInTheDocument()
    expect(screen.getByText('12.3400')).toBeInTheDocument()
    expect(screen.queryByText(/Best Return:/i)).not.toBeInTheDocument()
  })

  it('shows best Return and Drawdown for multi-objective runs', () => {
    render(
      <OptimizationProgress
        status={{
          ...baseStatus,
          best_value: null,
          optimization_config: {
            study: { name: 'Multi-objective study', n_trials: 20, sampler: 'nsgaii' },
            objective: { mode: 'multi_objective_return_drawdown' },
            backtest: {
              symbol: 'PETR4',
              start: '2024-01-01',
              end: '2024-06-01',
              initial_capital: 100000,
              point_value: 1,
              strategy: 'MACrossover',
              engine: 'candle',
            },
            search_space: { strategy_params: {}, risk_params: {} },
          },
          trials: [
            {
              number: 1,
              params: {},
              values: [0.1, 0.15],
              state: 'COMPLETE',
              user_attrs: { status: 'complete' },
            },
            {
              number: 2,
              params: {},
              values: [0.25, 0.08],
              state: 'COMPLETE',
              user_attrs: { status: 'complete' },
            },
            {
              number: 3,
              params: {},
              values: [0.18, 0.05],
              state: 'COMPLETE',
              user_attrs: { status: 'complete' },
            },
          ],
        }}
        onCancel={vi.fn()}
        cancelling={false}
      />,
    )

    expect(screen.getByText(/Best Return:/i)).toBeInTheDocument()
    expect(screen.getByText(/Best Drawdown:/i)).toBeInTheDocument()
    expect(screen.getByText('25.00%')).toBeInTheDocument()
    expect(screen.getByText('5.00%')).toBeInTheDocument()
    expect(screen.queryByText(/Best objective:/i)).not.toBeInTheDocument()
  })
})
