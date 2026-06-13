import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WalkForwardProgress } from '@/components/walkforward/WalkForwardProgress'
import type { WalkForwardStatus } from '@/types/walkforward'

describe('WalkForwardProgress', () => {
  it('renders window progress and phase label', () => {
    const status: WalkForwardStatus = {
      run_id: 'wf-1',
      status: 'running',
      current_window: 2,
      total_windows: 5,
      phase: 'optimizing',
      windows_completed: 2,
      error: null,
    }

    render(<WalkForwardProgress status={status} onCancel={vi.fn()} cancelling={false} />)

    expect(screen.getByText(/Window 3 \/ 5 — optimizing/i)).toBeInTheDocument()
    expect(screen.getByText(/Windows completed: 2 \/ 5/i)).toBeInTheDocument()
  })

  it('shows parallel execution header when running across multiple workers', () => {
    const status: WalkForwardStatus = {
      run_id: 'wf-par',
      status: 'running',
      current_window: 6,
      total_windows: 28,
      workers: 16,
      phase: 'testing',
      windows_completed: 6,
      error: null,
    }

    render(<WalkForwardProgress status={status} onCancel={vi.fn()} cancelling={false} />)

    expect(screen.getByText(/Optimizing 28 windows · 16 in parallel/i)).toBeInTheDocument()
    expect(screen.getByText(/Windows completed: 6 \/ 28/i)).toBeInTheDocument()
  })

  it('shows restart hint when phase is unavailable', () => {
    const status: WalkForwardStatus = {
      run_id: 'wf-2',
      status: 'running',
      current_window: 1,
      total_windows: 4,
      phase: null,
      windows_completed: 1,
      error: null,
    }

    render(<WalkForwardProgress status={status} onCancel={vi.fn()} cancelling={false} />)

    expect(screen.getByText(/Live phase unavailable/i)).toBeInTheDocument()
  })
})
