import type { StateCreator } from 'zustand'

import type { WorkspaceId } from '@/types/api'

export type WorkspaceSlice = {
  activeWorkspace: WorkspaceId
  selectedSymbol: string
  setActiveWorkspace: (workspace: WorkspaceId) => void
  setSelectedSymbol: (symbol: string) => void
}

export const createWorkspaceSlice: StateCreator<WorkspaceSlice> = (set) => ({
  activeWorkspace: 'launcher',
  selectedSymbol: 'PETR4',
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
})
