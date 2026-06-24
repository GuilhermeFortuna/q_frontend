import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ParetoFrontPanel } from '@/components/optimize/ParetoFrontPanel'
import type { OptimizationAnalytics } from '@/types/optimization'

function mockAnalytics(overrides: Partial<OptimizationAnalytics> = {}): OptimizationAnalytics {
  return {
    study_id: 'study-analytics',
    status: 'done',
    is_multi_objective: true,
    n_complete_trials: 3,
    objective_labels: ['return', 'drawdown'],
    param_importances: null,
    parallel_coordinate: {
      params: ['short_period', 'long_period'],
      objectives: ['return', 'drawdown'],
      rows: [
        { number: 0, params: { short_period: 2, long_period: 20 }, values: [0.2, 0.8] },
        { number: 1, params: { short_period: 3, long_period: 21 }, values: [0.5, 0.5] },
        { number: 2, params: { short_period: 4, long_period: 22 }, values: [0.8, 0.2] },
      ],
    },
    pareto_front: {
      is_multi_objective: true,
      objectives: ['return', 'drawdown'],
      points: [
        { number: 0, values: [0.2, 0.8], params: { short_period: 2, long_period: 20 } },
        { number: 2, values: [0.8, 0.2], params: { short_period: 4, long_period: 22 } },
      ],
    },
    ...overrides,
  }
}

describe('ParetoFrontPanel', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 640,
      height: 280,
      top: 0,
      left: 0,
      right: 640,
      bottom: 280,
      toJSON: () => ({}),
    } as DOMRect)
  })

  it('renders multi-objective frontier points highlighted', async () => {
    const { container, getByText } = render(<ParetoFrontPanel analytics={mockAnalytics()} />)

    await waitFor(() => {
      expect(getByText('Pareto Front')).not.toBeNull()
      expect(container.querySelector('.recharts-surface')).not.toBeNull()
      expect(container.querySelectorAll('.recharts-scatter-symbol').length).toBeGreaterThan(0)
    })
  })

  it('renders single-objective best-point highlight without frontier line', async () => {
    const analytics = mockAnalytics({
      is_multi_objective: false,
      objective_labels: ['maximize_net_profit'],
      parallel_coordinate: {
        params: ['x'],
        objectives: ['maximize_net_profit'],
        rows: [
          { number: 0, params: { x: 1 }, values: [0.2] },
          { number: 1, params: { x: 2 }, values: [0.9] },
        ],
      },
      pareto_front: {
        is_multi_objective: false,
        objectives: ['maximize_net_profit'],
        points: [{ number: 1, values: [0.9], params: { x: 2 } }],
      },
    })

    const { container, getByText } = render(<ParetoFrontPanel analytics={analytics} />)

    await waitFor(() => {
      expect(getByText('Best Trial Highlight')).not.toBeNull()
      expect(getByText(/Single-objective study/)).not.toBeNull()
      expect(container.querySelector('.recharts-line')).toBeNull()
      expect(container.querySelector('.recharts-scatter-symbol')).not.toBeNull()
    })
  })

  it('shows empty state when there are no points', () => {
    const analytics = mockAnalytics({
      n_complete_trials: 0,
      parallel_coordinate: { params: [], objectives: ['return', 'drawdown'], rows: [] },
      pareto_front: { is_multi_objective: true, objectives: ['return', 'drawdown'], points: [] },
    })

    const { getByText } = render(<ParetoFrontPanel analytics={analytics} />)
    expect(getByText(/Completed trials will appear here/)).not.toBeNull()
  })
})
