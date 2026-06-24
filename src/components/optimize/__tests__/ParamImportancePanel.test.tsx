import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ParamImportancePanel } from '@/components/optimize/ParamImportancePanel'
import type { OptimizationAnalytics } from '@/types/optimization'

function mockAnalytics(overrides: Partial<OptimizationAnalytics> = {}): OptimizationAnalytics {
  return {
    study_id: 'study-importance',
    status: 'done',
    is_multi_objective: false,
    n_complete_trials: 30,
    objective_labels: ['maximize_net_profit'],
    param_importances: null,
    parallel_coordinate: { params: [], objectives: ['maximize_net_profit'], rows: [] },
    pareto_front: {
      is_multi_objective: false,
      objectives: ['maximize_net_profit'],
      points: [],
    },
    ...overrides,
  }
}

describe('ParamImportancePanel', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 640,
      height: 200,
      top: 0,
      left: 0,
      right: 640,
      bottom: 200,
      toJSON: () => ({}),
    } as DOMRect)
  })

  it('shows running-pending copy when importances are null and study is active', () => {
    const { getByText, queryByRole } = render(
      <ParamImportancePanel
        analytics={mockAnalytics({ status: 'running', param_importances: null })}
      />,
    )

    expect(getByText(/Importance is computed once the search finishes/)).not.toBeNull()
    expect(queryByRole('img', { hidden: true })).toBeNull()
    expect(document.querySelector('.recharts-surface')).toBeNull()
  })

  it('shows insufficient-trials copy when importances are null and study is terminal', () => {
    const { getByText } = render(
      <ParamImportancePanel
        analytics={mockAnalytics({
          status: 'done',
          n_complete_trials: 12,
          param_importances: null,
        })}
      />,
    )

    expect(
      getByText(/Not enough completed trials to rank importance \(needs ≥ 30\)/),
    ).not.toBeNull()
  })

  it('renders bars for single-objective importances without a target toggle', async () => {
    const { queryByRole, container } = render(
      <ParamImportancePanel
        analytics={mockAnalytics({
          param_importances: {
            maximize_net_profit: [
              { param: 'short_period', importance: 0.62 },
              { param: 'long_period', importance: 0.31 },
            ],
          },
        })}
      />,
    )

    await waitFor(() => {
      expect(container.querySelector('.recharts-surface')).not.toBeNull()
      expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBeGreaterThan(0)
      expect(container.textContent).toContain('0.62')
      expect(container.textContent).toContain('0.31')
    })
    expect(queryByRole('button', { name: 'return' })).toBeNull()
    expect(queryByRole('button', { name: 'drawdown' })).toBeNull()
  })

  it('switches multi-objective targets locally without refetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const analytics = mockAnalytics({
      is_multi_objective: true,
      objective_labels: ['return', 'drawdown'],
      param_importances: {
        return: [
          { param: 'short_period', importance: 0.62 },
          { param: 'long_period', importance: 0.28 },
        ],
        drawdown: [
          { param: 'atr_mult', importance: 0.55 },
          { param: 'short_period', importance: 0.25 },
        ],
      },
    })

    const { getByRole, container } = render(<ParamImportancePanel analytics={analytics} />)

    await waitFor(() => {
      expect(getByRole('button', { name: 'return' })).not.toBeNull()
      expect(getByRole('button', { name: 'drawdown' })).not.toBeNull()
      expect(container.textContent).toContain('0.62')
      expect(container.textContent).not.toContain('0.55')
    })

    fireEvent.click(getByRole('button', { name: 'drawdown' }))

    await waitFor(() => {
      expect(container.textContent).toContain('0.55')
      expect(container.textContent).not.toContain('0.28')
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
