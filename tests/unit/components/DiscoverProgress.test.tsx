import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DiscoverProgress } from '@/components/discover/DiscoverProgress'
import type { StrategySearchStatus } from '@/types/strategySearch'

describe('DiscoverProgress', () => {
  it('renders candidate and window progress', () => {
    const status: StrategySearchStatus = {
      run_id: 'ss-1',
      status: 'running',
      current_candidate: 3,
      total_candidates: 9,
      candidate_id: 'RSIMeanReversion',
      strategy: 'RSIMeanReversion',
      phase: 'testing',
      window_index: 1,
      total_windows: 4,
      error: null,
    }

    render(<DiscoverProgress status={status} onCancel={vi.fn()} cancelling={false} />)

    expect(
      screen.getByText(/Candidate 3 \/ 9 — RSIMeanReversion — window 2\/4 testing/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Candidates: 3 \/ 9/i)).toBeInTheDocument()
  })

  it('shows restart hint when phase is unavailable', () => {
    const status: StrategySearchStatus = {
      run_id: 'ss-2',
      status: 'running',
      current_candidate: 2,
      total_candidates: 5,
      candidate_id: 'VMA',
      strategy: 'VMA',
      phase: null,
      window_index: null,
      total_windows: null,
      error: null,
    }

    render(<DiscoverProgress status={status} onCancel={vi.fn()} cancelling={false} />)

    expect(screen.getByText(/Live window phase unavailable/i)).toBeInTheDocument()
  })
})

describe('strategy search polling helpers', () => {
  it('treats completed and cancelled as terminal', async () => {
    const { isStrategySearchTerminalStatus, shouldFetchStrategySearchResults } =
      await import('@/types/strategySearch')

    expect(isStrategySearchTerminalStatus('completed')).toBe(true)
    expect(isStrategySearchTerminalStatus('cancelled')).toBe(true)
    expect(isStrategySearchTerminalStatus('running')).toBe(false)
    expect(shouldFetchStrategySearchResults('completed')).toBe(true)
    expect(shouldFetchStrategySearchResults('running')).toBe(false)
  })
})
