import type { StateCreator } from 'zustand'

export type BrightnessMode = 'high' | 'mid' | 'low' | 'auto'

export type PreferencesSlice = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  brightnessMode: BrightnessMode
  autoBrightnessHighStart: number
  autoBrightnessMidStart: number
  autoBrightnessLowStart: number
  setBrightnessMode: (mode: BrightnessMode) => void
  setAutoBrightnessConfig: (config: {
    highStart?: number
    midStart?: number
    lowStart?: number
  }) => void
}

export const createPreferencesSlice: StateCreator<PreferencesSlice> = (set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),
  brightnessMode: 'high',
  autoBrightnessHighStart: 9,
  autoBrightnessMidStart: 18,
  autoBrightnessLowStart: 21,
  setBrightnessMode: (mode) => set({ brightnessMode: mode }),
  setAutoBrightnessConfig: (config) =>
    set((state) => ({
      autoBrightnessHighStart: config.highStart ?? state.autoBrightnessHighStart,
      autoBrightnessMidStart: config.midStart ?? state.autoBrightnessMidStart,
      autoBrightnessLowStart: config.lowStart ?? state.autoBrightnessLowStart,
    })),
})
