import type { StateCreator } from 'zustand'

import type { OptimizationBacktestConfig, OptimizationConfig } from '@/types/optimization'

export type JobPanelTab = 'results' | 'history'

/**
 * Per-workspace "active job session" state. These mirror the local UI state the
 * job workspaces used to hold in `useState` — the running job id, the config
 * that was submitted, and the panel layout. Lifting them into the store (and
 * persisting them) lets a job started on one page survive navigating away: when
 * the workspace remounts the id is restored and React Query resumes polling.
 */
export type OptimizeSession = {
  studyId: string | null
  /** Configs keyed by study id, so each study renders against the params it ran with. */
  studyBacktestConfigs: Record<string, OptimizationBacktestConfig>
  submittedConfig: OptimizationConfig | null
  workbenchOpen: boolean
  rightPanelTab: JobPanelTab
  selectedHistoryStudyId: string | null
}

export type WalkForwardSession = {
  runId: string | null
  submittedBacktest: OptimizationBacktestConfig | null
  workbenchOpen: boolean
  rightPanelTab: JobPanelTab
  selectedHistoryRunId: string | null
}

export type DiscoverSession = {
  runId: string | null
  submittedBacktest: OptimizationBacktestConfig | null
  workbenchOpen: boolean
  rightPanelTab: JobPanelTab
  selectedHistoryRunId: string | null
}

export type JobSessionsSlice = {
  optimizeSession: OptimizeSession
  walkForwardSession: WalkForwardSession
  discoverSession: DiscoverSession
  patchOptimizeSession: (patch: Partial<OptimizeSession>) => void
  patchWalkForwardSession: (patch: Partial<WalkForwardSession>) => void
  patchDiscoverSession: (patch: Partial<DiscoverSession>) => void
}

const initialOptimizeSession: OptimizeSession = {
  studyId: null,
  studyBacktestConfigs: {},
  submittedConfig: null,
  workbenchOpen: true,
  rightPanelTab: 'results',
  selectedHistoryStudyId: null,
}

const initialWalkForwardSession: WalkForwardSession = {
  runId: null,
  submittedBacktest: null,
  workbenchOpen: true,
  rightPanelTab: 'results',
  selectedHistoryRunId: null,
}

const initialDiscoverSession: DiscoverSession = {
  runId: null,
  submittedBacktest: null,
  workbenchOpen: true,
  rightPanelTab: 'results',
  selectedHistoryRunId: null,
}

export const createJobSessionsSlice: StateCreator<JobSessionsSlice> = (set) => ({
  optimizeSession: initialOptimizeSession,
  walkForwardSession: initialWalkForwardSession,
  discoverSession: initialDiscoverSession,
  patchOptimizeSession: (patch) =>
    set((state) => ({ optimizeSession: { ...state.optimizeSession, ...patch } })),
  patchWalkForwardSession: (patch) =>
    set((state) => ({ walkForwardSession: { ...state.walkForwardSession, ...patch } })),
  patchDiscoverSession: (patch) =>
    set((state) => ({ discoverSession: { ...state.discoverSession, ...patch } })),
})
