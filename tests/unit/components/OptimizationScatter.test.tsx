import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CartesianGrid, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'

import { OptimizationScatter } from '@/components/optimize/OptimizationScatter'
import { getMockOptimizationResults } from '@/mocks/data'
import type { OptimizationResults } from '@/types/optimization'

describe('OptimizationScatter', () => {
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

  it('renders optimization history chart surface for completed trials', async () => {
    const results = getMockOptimizationResults('study-win-ma')
    expect(results).not.toBeNull()

    const { container } = render(
      <OptimizationScatter results={results!} selectedTrialNumber={results!.best_trial?.number} />,
    )

    await waitFor(() => {
      expect(container.querySelector('.recharts-surface')).not.toBeNull()
      expect(container.querySelector('.recharts-scatter-symbol')).not.toBeNull()
    })
  })

  it('renders Pareto Front chart for multi-objective trials', async () => {
    const results: OptimizationResults = {
      study_id: 'study-multi',
      objective_mode: 'multi_objective_return_drawdown',
      is_multi_objective: true,
      best_params: {
        strategy__short_period: 12,
        strategy__long_period: 64,
      },
      best_trial: {
        number: 3,
        params: { strategy__short_period: 12, strategy__long_period: 64 },
        values: [0.25, 0.05],
        state: 'COMPLETE',
        user_attrs: {
          status: 'complete',
          metrics: { total_pnl: 25000, max_drawdown_pct: 0.05, total_trades: 12 },
          strategy_params: { short_period: 12, long_period: 64 },
          risk_params: { type: 'fixed_quantity', quantity: 2 },
        },
      },
      trials: [
        {
          number: 1,
          params: { strategy__short_period: 5, strategy__long_period: 40 },
          values: [0.1, 0.15],
          state: 'COMPLETE',
          user_attrs: {
            status: 'complete',
            metrics: { total_pnl: 10000, max_drawdown_pct: 0.15, total_trades: 8 },
            strategy_params: { short_period: 5, long_period: 40 },
            risk_params: { type: 'fixed_quantity', quantity: 2 },
          },
        },
        {
          number: 2,
          params: { strategy__short_period: 8, strategy__long_period: 50 },
          values: [0.18, 0.08],
          state: 'COMPLETE',
          user_attrs: {
            status: 'complete',
            metrics: { total_pnl: 18000, max_drawdown_pct: 0.08, total_trades: 10 },
            strategy_params: { short_period: 8, long_period: 50 },
            risk_params: { type: 'fixed_quantity', quantity: 2 },
          },
        },
        {
          number: 3,
          params: { strategy__short_period: 12, strategy__long_period: 64 },
          values: [0.25, 0.05],
          state: 'COMPLETE',
          user_attrs: {
            status: 'complete',
            metrics: { total_pnl: 25000, max_drawdown_pct: 0.05, total_trades: 12 },
            strategy_params: { short_period: 12, long_period: 64 },
            risk_params: { type: 'fixed_quantity', quantity: 2 },
          },
        },
      ],
      pareto_trials: [
        {
          number: 2,
          params: { strategy__short_period: 8, strategy__long_period: 50 },
          values: [0.18, 0.08],
          state: 'COMPLETE',
          user_attrs: {
            status: 'complete',
            metrics: { total_pnl: 18000, max_drawdown_pct: 0.08, total_trades: 10 },
            strategy_params: { short_period: 8, long_period: 50 },
            risk_params: { type: 'fixed_quantity', quantity: 2 },
          },
        },
        {
          number: 3,
          params: { strategy__short_period: 12, strategy__long_period: 64 },
          values: [0.25, 0.05],
          state: 'COMPLETE',
          user_attrs: {
            status: 'complete',
            metrics: { total_pnl: 25000, max_drawdown_pct: 0.05, total_trades: 12 },
            strategy_params: { short_period: 12, long_period: 64 },
            risk_params: { type: 'fixed_quantity', quantity: 2 },
          },
        },
      ],
      failures: [],
    }

    const { container, getByText } = render(
      <OptimizationScatter results={results} selectedTrialNumber={results.best_trial!.number} />,
    )

    await waitFor(() => {
      expect(container.querySelector('.recharts-surface')).not.toBeNull()
      expect(getByText('Pareto Front — Return vs Drawdown')).not.toBeNull()
    })
  })

  it('renders scatter symbols in a bare ScatterChart control', async () => {
    const { container } = render(
      <ScatterChart width={640} height={280} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="#2e333b" strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" />
        <YAxis type="number" dataKey="y" width={72} />
        <Tooltip />
        <Scatter
          data={[
            { x: 1, y: 10, n: 1 },
            { x: 2, y: 20, n: 2 },
          ]}
          fill="#9aa1ac"
        />
      </ScatterChart>,
    )

    await waitFor(() => {
      expect(container.querySelector('.recharts-scatter-symbol')).not.toBeNull()
    })
  })
})
