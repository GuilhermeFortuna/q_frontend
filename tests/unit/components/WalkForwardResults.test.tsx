import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WalkForwardWindowsTable } from '@/components/walkforward/WalkForwardWindowsTable'
import type { WalkForwardWindowResult } from '@/types/walkforward'

const windows: WalkForwardWindowResult[] = [
  {
    index: 0,
    train_start: '2024-01-01T00:00:00Z',
    train_end: '2024-06-01T00:00:00Z',
    test_start: '2024-06-02T00:00:00Z',
    test_end: '2024-07-01T00:00:00Z',
    status: 'completed',
    best_params: { short_period: 5 },
    is_metrics: { return_drawdown_ratio: 2.0 },
    oos_metrics: { return_drawdown_ratio: 0.8 },
  },
  {
    index: 1,
    train_start: '2024-02-01T00:00:00Z',
    train_end: '2024-07-01T00:00:00Z',
    test_start: '2024-07-02T00:00:00Z',
    test_end: '2024-08-01T00:00:00Z',
    status: 'no_result',
    best_params: {},
    is_metrics: null,
    oos_metrics: null,
  },
]

describe('WalkForwardWindowsTable', () => {
  it('renders IS/OOS metric pairs and marks no_result windows', () => {
    render(<WalkForwardWindowsTable windows={windows} objectiveMode="maximize_return_drawdown" />)

    expect(screen.getByText('2.000')).toBeInTheDocument()
    expect(screen.getByText('0.800')).toBeInTheDocument()
    expect(screen.getByText('no result')).toBeInTheDocument()
  })
})

describe('WalkForwardResultsView efficiency', () => {
  it('formats null efficiency via shared helper', async () => {
    const { formatEfficiencyRatio } = await import('@/lib/walkforward/objectiveMetric')
    expect(formatEfficiencyRatio(null)).toBe('—')
  })
})
