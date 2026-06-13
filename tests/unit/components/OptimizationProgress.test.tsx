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
})
