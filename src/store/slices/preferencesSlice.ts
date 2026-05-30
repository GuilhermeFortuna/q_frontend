import type { StateCreator } from 'zustand'

export type PreferencesSlice = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const createPreferencesSlice: StateCreator<PreferencesSlice> = (set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),
})
