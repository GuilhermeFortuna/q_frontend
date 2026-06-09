import type { StateCreator } from 'zustand'

import type { WorkspaceId } from '@/types/api'
import type { BacktestRequest } from '@/types/backtesting'
import type { OptimizationConfig } from '@/types/optimization'

export type WorkspaceSlice = {
  activeWorkspace: WorkspaceId
  selectedSymbol: string
  /** Config staged by the Optimizer for the Backtest workspace to consume on mount. */
  pendingBacktestConfig: BacktestRequest | null
  /** Config staged by optimization history for the Optimizer form to consume. */
  pendingOptimizationConfig: OptimizationConfig | null
  setActiveWorkspace: (workspace: WorkspaceId) => void
  setSelectedSymbol: (symbol: string) => void
  setPendingBacktestConfig: (config: BacktestRequest | null) => void
  setPendingOptimizationConfig: (config: OptimizationConfig | null) => void
}

export const createWorkspaceSlice: StateCreator<WorkspaceSlice> = (set) => ({
  activeWorkspace: 'launcher',
  selectedSymbol: 'PETR4',
  pendingBacktestConfig: null,
  pendingOptimizationConfig: null,
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setPendingBacktestConfig: (config) => set({ pendingBacktestConfig: config }),
  setPendingOptimizationConfig: (config) => set({ pendingOptimizationConfig: config }),
})
