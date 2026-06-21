import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CollapsedOptimizeResultsTeaser } from '@/components/optimize/focus/CollapsedOptimizeResultsTeaser'
import type { OptimizationResults } from '@/types/optimization'

describe('CollapsedOptimizeResultsTeaser', () => {
  it('formats multi-objective best trial values as percentages', () => {
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
        user_attrs: { status: 'complete' },
      },
      trials: [
        {
          number: 2,
          params: {},
          values: [0.25, 0.05],
          state: 'COMPLETE',
          user_attrs: { status: 'complete' },
        },
      ],
      pareto_trials: [],
      failures: [],
    }

    render(
      <CollapsedOptimizeResultsTeaser
        isRunning={false}
        hasResults
        status={undefined}
        results={results}
        onExpand={vi.fn()}
        onOpenHistory={vi.fn()}
      />,
    )

    expect(screen.getByText('Ret: 25.00%, DD: 5.00%')).toBeInTheDocument()
  })

  it('formats single-objective best trial values as raw decimals', () => {
    const results: OptimizationResults = {
      study_id: 'study-single',
      objective_mode: 'maximize_net_profit',
      is_multi_objective: false,
      best_params: {},
      best_trial: {
        number: 1,
        params: {},
        values: [1234.5678],
        state: 'COMPLETE',
        user_attrs: { status: 'complete' },
      },
      trials: [
        {
          number: 1,
          params: {},
          values: [1234.5678],
          state: 'COMPLETE',
          user_attrs: { status: 'complete' },
        },
      ],
      pareto_trials: [],
      failures: [],
    }

    render(
      <CollapsedOptimizeResultsTeaser
        isRunning={false}
        hasResults
        status={undefined}
        results={results}
        onExpand={vi.fn()}
        onOpenHistory={vi.fn()}
      />,
    )

    expect(screen.getByText('1234.5678')).toBeInTheDocument()
  })
})
