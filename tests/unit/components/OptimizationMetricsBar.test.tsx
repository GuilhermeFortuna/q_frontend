import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OptimizationMetricsBar } from '@/components/optimize/OptimizationMetricsBar'
import type { OptimizationResults, OptimizationTrial } from '@/types/optimization'

function makeTrial(number: number, values: number[]): OptimizationTrial {
  return {
    number,
    params: {},
    values,
    state: 'COMPLETE',
    user_attrs: { status: 'complete' },
  }
}

function makeResults(overrides: Partial<OptimizationResults>): OptimizationResults {
  return {
    study_id: 'study-1',
    objective_mode: 'maximize_net_profit',
    is_multi_objective: false,
    best_params: {},
    best_trial: null,
    trials: [],
    pareto_trials: [],
    failures: [],
    ...overrides,
  }
}

describe('OptimizationMetricsBar', () => {
  it('renders single Best Objective card for single-objective results', () => {
    const results = makeResults({
      best_trial: makeTrial(1, [1234.5678]),
      trials: [makeTrial(1, [1234.5678])],
    })

    render(<OptimizationMetricsBar results={results} />)

    expect(screen.getByText('Best Objective')).toBeInTheDocument()
    expect(screen.getByText('1234.5678')).toBeInTheDocument()
    expect(screen.queryByText('Best Return')).not.toBeInTheDocument()
    expect(screen.queryByText('Best Drawdown')).not.toBeInTheDocument()
  })

  it('renders separate Best Return and Best Drawdown cards for multi-objective results', () => {
    const results = makeResults({
      objective_mode: 'multi_objective_return_drawdown',
      is_multi_objective: true,
      best_trial: makeTrial(2, [0.18, 0.08]),
      trials: [makeTrial(1, [0.1, 0.15]), makeTrial(2, [0.25, 0.08]), makeTrial(3, [0.18, 0.05])],
    })

    render(<OptimizationMetricsBar results={results} />)

    expect(screen.getByText('Best Return')).toBeInTheDocument()
    expect(screen.getByText('Best Drawdown')).toBeInTheDocument()
    expect(screen.getByText('25.00%')).toBeInTheDocument()
    expect(screen.getByText('5.00%')).toBeInTheDocument()
    expect(screen.queryByText('Best Objective')).not.toBeInTheDocument()
  })

  it('renders completed, pruned, and failed counts', () => {
    const results = makeResults({
      trials: [
        makeTrial(1, [0.1, 0.05]),
        { ...makeTrial(2, [0.2, 0.08]), state: 'PRUNED', user_attrs: { status: 'pruned' } },
      ],
      failures: [{ trial_number: 3, error: 'timeout' }],
    })

    render(<OptimizationMetricsBar results={results} />)

    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Pruned')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })
})
