import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CartesianGrid, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'

import { OptimizationScatter } from '@/components/optimize/OptimizationScatter'
import { getMockOptimizationResults } from '@/mocks/data'

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
