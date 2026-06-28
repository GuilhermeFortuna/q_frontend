import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createJobSessionsSlice, type JobSessionsSlice } from '@/store/slices/jobSessionsSlice'
import { createPreferencesSlice, type PreferencesSlice } from '@/store/slices/preferencesSlice'
import { createWorkspaceSlice, type WorkspaceSlice } from '@/store/slices/workspaceSlice'

export type AppStore = WorkspaceSlice & PreferencesSlice & JobSessionsSlice

export const useAppStore = create<AppStore>()(
  persist(
    (...args) => ({
      ...createWorkspaceSlice(...args),
      ...createPreferencesSlice(...args),
      ...createJobSessionsSlice(...args),
    }),
    {
      name: 'q-app-store',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppStore> | undefined
        if (!state) return persistedState
        return {
          ...state,
          launcherSession: { panelLayouts: null },
        }
      },
      // Only the active job sessions need to outlive navigation/reload. Everything
      // else is transient UI or sourced from the backend.
      partialize: (state) => ({
        optimizeSession: state.optimizeSession,
        walkForwardSession: state.walkForwardSession,
        discoverSession: state.discoverSession,
        backtestSession: state.backtestSession,
        marketDataSession: state.marketDataSession,
        launcherSession: state.launcherSession,
        activeWorkspace: state.activeWorkspace,
        selectedSymbol: state.selectedSymbol,
        pendingBacktestConfig: state.pendingBacktestConfig,
        pendingOptimizationConfig: state.pendingOptimizationConfig,
        brightnessMode: state.brightnessMode,
        autoBrightnessHighStart: state.autoBrightnessHighStart,
        autoBrightnessMidStart: state.autoBrightnessMidStart,
        autoBrightnessLowStart: state.autoBrightnessLowStart,
        motionMode: state.motionMode,
        particleSpeedMode: state.particleSpeedMode,
        particleColorMode: state.particleColorMode,
      }),
    },
  ),
)
