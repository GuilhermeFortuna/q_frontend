import type { StateCreator } from 'zustand'

import {
  DEFAULT_INDICATORS,
  DEFAULT_SETTINGS,
  type ChartSettings,
  type ChartType,
  type DrawingTool,
  type IndicatorConfig,
} from '@/components/charts/types/chart'
import type { BacktestRequest, BacktestRunSummary } from '@/types/backtesting'
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

export type BacktestWorkbenchFocus = 'setup' | 'results'

/**
 * Backtests are now async jobs, so the active run id must outlive navigation just
 * like the other job workspaces — when the workspace remounts the id is restored
 * and polling resumes.
 */
export type BacktestSession = {
  runId: string | null
  lastCapital: number
  lastRequest: BacktestRequest | null
  focus: BacktestWorkbenchFocus
  rightPanelTab: JobPanelTab
  selectedHistoryRunId: string | null
  comparisonRuns: BacktestRunSummary[] | null
}

export type MarketDataSession = {
  selectedTimeframe: string
  chartType: ChartType
  indicators: IndicatorConfig[]
  showGrid: boolean
  chartSettings: ChartSettings
  activeDrawingTool: DrawingTool
  sidebarCollapsed: boolean
  detailCollapsed: boolean
}

export type JobSessionsSlice = {
  optimizeSession: OptimizeSession
  walkForwardSession: WalkForwardSession
  discoverSession: DiscoverSession
  backtestSession: BacktestSession
  marketDataSession: MarketDataSession
  patchOptimizeSession: (patch: Partial<OptimizeSession>) => void
  patchWalkForwardSession: (patch: Partial<WalkForwardSession>) => void
  patchDiscoverSession: (patch: Partial<DiscoverSession>) => void
  patchBacktestSession: (patch: Partial<BacktestSession>) => void
  patchMarketDataSession: (patch: Partial<MarketDataSession>) => void
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

const initialBacktestSession: BacktestSession = {
  runId: null,
  lastCapital: 100000,
  lastRequest: null,
  focus: 'setup',
  rightPanelTab: 'results',
  selectedHistoryRunId: null,
  comparisonRuns: null,
}

const initialMarketDataSession: MarketDataSession = {
  selectedTimeframe: '1D',
  chartType: 'candles',
  indicators: DEFAULT_INDICATORS,
  showGrid: true,
  chartSettings: DEFAULT_SETTINGS,
  activeDrawingTool: 'cursor',
  sidebarCollapsed: false,
  detailCollapsed: false,
}

export const createJobSessionsSlice: StateCreator<JobSessionsSlice> = (set) => ({
  optimizeSession: initialOptimizeSession,
  walkForwardSession: initialWalkForwardSession,
  discoverSession: initialDiscoverSession,
  backtestSession: initialBacktestSession,
  marketDataSession: initialMarketDataSession,
  patchOptimizeSession: (patch) =>
    set((state) => ({ optimizeSession: { ...state.optimizeSession, ...patch } })),
  patchWalkForwardSession: (patch) =>
    set((state) => ({ walkForwardSession: { ...state.walkForwardSession, ...patch } })),
  patchDiscoverSession: (patch) =>
    set((state) => ({ discoverSession: { ...state.discoverSession, ...patch } })),
  patchBacktestSession: (patch) =>
    set((state) => ({ backtestSession: { ...state.backtestSession, ...patch } })),
  patchMarketDataSession: (patch) =>
    set((state) => ({ marketDataSession: { ...state.marketDataSession, ...patch } })),
})
