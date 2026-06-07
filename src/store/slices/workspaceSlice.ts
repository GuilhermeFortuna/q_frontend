import type { StateCreator } from 'zustand'

import type { WorkspaceId } from '@/types/api'
import type { BacktestRequest } from '@/types/backtesting'

export type WorkspaceSlice = {
  activeWorkspace: WorkspaceId
  selectedSymbol: string
  /** Config staged by the Optimizer for the Backtest workspace to consume on mount. */
  pendingBacktestConfig: BacktestRequest | null
  setActiveWorkspace: (workspace: WorkspaceId) => void
  setSelectedSymbol: (symbol: string) => void
  setPendingBacktestConfig: (config: BacktestRequest | null) => void
}

export const createWorkspaceSlice: StateCreator<WorkspaceSlice> = (set) => ({
  activeWorkspace: 'launcher',
  selectedSymbol: 'PETR4',
  pendingBacktestConfig: null,
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setPendingBacktestConfig: (config) => set({ pendingBacktestConfig: config }),
})
