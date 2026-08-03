import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useOptimizationStatus = vi.fn()
const useWalkForwardStatus = vi.fn()
const useStrategySearchStatus = vi.fn()
const useBacktestJobStatus = vi.fn()

const storeState = {
  optimizeSession: { studyId: null as string | null },
  walkForwardSession: { runId: null as string | null },
  discoverSession: { runId: null as string | null },
  backtestSession: { runId: null as string | null },
}

vi.mock('@/api/queries/optimize', () => ({
  useOptimizationStatus: (studyId: string | null) => useOptimizationStatus(studyId),
}))

vi.mock('@/api/queries/walkforward', () => ({
  useWalkForwardStatus: (runId: string | null) => useWalkForwardStatus(runId),
}))

vi.mock('@/api/queries/strategySearch', () => ({
  useStrategySearchStatus: (runId: string | null) => useStrategySearchStatus(runId),
}))

vi.mock('@/api/queries/backtests', () => ({
  useBacktestJobStatus: (runId: string | null) => useBacktestJobStatus(runId),
}))

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}))

import { useActiveJobs } from '@/hooks/useActiveJobs'

function idleQuery() {
  return { data: undefined }
}

describe('useActiveJobs', () => {
  beforeEach(() => {
    storeState.optimizeSession.studyId = null
    storeState.walkForwardSession.runId = null
    storeState.discoverSession.runId = null
    storeState.backtestSession.runId = null
    useOptimizationStatus.mockReset().mockReturnValue(idleQuery())
    useWalkForwardStatus.mockReset().mockReturnValue(idleQuery())
    useStrategySearchStatus.mockReset().mockReturnValue(idleQuery())
    useBacktestJobStatus.mockReset().mockReturnValue(idleQuery())
  })

  it('returns an empty map when no jobs are active', () => {
    const { result } = renderHook(() => useActiveJobs())
    expect(result.current).toEqual({})
  })

  it('maps optimize progress onto backtests as determinate', () => {
    storeState.optimizeSession.studyId = 'opt-1'
    useOptimizationStatus.mockReturnValue({
      data: { status: 'running', completed_trials: 12, n_trials: 50 },
    })

    const { result } = renderHook(() => useActiveJobs())

    expect(result.current.backtests).toEqual({
      workspaceId: 'backtests',
      workspaceLabel: 'Backtests',
      pct: 24,
      detail: 'Optimize: Trial 12 / 50',
      progressKind: 'determinate',
    })
  })

  it('maps a running backtest as indeterminate without pretending 0% is measured', () => {
    storeState.backtestSession.runId = 'bt-1'
    useBacktestJobStatus.mockReturnValue({
      data: { status: 'running' },
    })

    const { result } = renderHook(() => useActiveJobs())

    expect(result.current.backtests).toEqual({
      workspaceId: 'backtests',
      workspaceLabel: 'Backtests',
      pct: 0,
      detail: 'Running…',
      progressKind: 'indeterminate',
    })
  })

  it('prefers optimize over backtest when both are active', () => {
    storeState.optimizeSession.studyId = 'opt-1'
    storeState.backtestSession.runId = 'bt-1'
    useOptimizationStatus.mockReturnValue({
      data: { status: 'pending', completed_trials: 0, n_trials: 10 },
    })
    useBacktestJobStatus.mockReturnValue({
      data: { status: 'running' },
    })

    const { result } = renderHook(() => useActiveJobs())
    expect(result.current.backtests?.detail).toMatch(/Optimize/)
    expect(result.current.backtests?.progressKind).toBe('determinate')
  })

  it('maps walk-forward onto validate', () => {
    storeState.walkForwardSession.runId = 'wf-1'
    useWalkForwardStatus.mockReturnValue({
      data: {
        status: 'running',
        windows_completed: 2,
        total_windows: 8,
        phase: 'testing',
      },
    })

    const { result } = renderHook(() => useActiveJobs())

    expect(result.current.validate).toEqual({
      workspaceId: 'validate',
      workspaceLabel: 'Validate',
      pct: 25,
      detail: 'Window 2 / 8 · testing',
      progressKind: 'determinate',
    })
  })

  it('maps discover preparing as indeterminate and candidate progress as determinate', () => {
    storeState.discoverSession.runId = 'disc-1'
    useStrategySearchStatus.mockReturnValue({
      data: {
        status: 'running',
        current_candidate: 0,
        total_candidates: 0,
      },
    })

    const { result, rerender } = renderHook(() => useActiveJobs())
    expect(result.current.discover).toMatchObject({
      detail: 'Preparing…',
      progressKind: 'indeterminate',
      pct: 0,
    })

    useStrategySearchStatus.mockReturnValue({
      data: {
        status: 'running',
        current_candidate: 3.2,
        total_candidates: 9,
        phase: 'optimizing',
      },
    })
    rerender()

    expect(result.current.discover).toEqual({
      workspaceId: 'discover',
      workspaceLabel: 'Discover',
      pct: 36,
      detail: 'Candidate 3 / 9 · optimizing',
      progressKind: 'determinate',
    })
  })

  it('invokes only the four existing status query hooks (no query growth)', () => {
    storeState.optimizeSession.studyId = 'opt-1'
    storeState.walkForwardSession.runId = 'wf-1'
    storeState.discoverSession.runId = 'disc-1'
    storeState.backtestSession.runId = 'bt-1'

    renderHook(() => useActiveJobs())

    expect(useOptimizationStatus).toHaveBeenCalledTimes(1)
    expect(useWalkForwardStatus).toHaveBeenCalledTimes(1)
    expect(useStrategySearchStatus).toHaveBeenCalledTimes(1)
    expect(useBacktestJobStatus).toHaveBeenCalledTimes(1)
    expect(useOptimizationStatus).toHaveBeenCalledWith('opt-1')
    expect(useWalkForwardStatus).toHaveBeenCalledWith('wf-1')
    expect(useStrategySearchStatus).toHaveBeenCalledWith('disc-1')
    expect(useBacktestJobStatus).toHaveBeenCalledWith('bt-1')
  })
})
