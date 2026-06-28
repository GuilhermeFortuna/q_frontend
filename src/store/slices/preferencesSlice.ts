import type { StateCreator } from 'zustand'

export type BrightnessMode = 'high' | 'mid' | 'low' | 'auto'

/**
 * Ambient-motion preference for decorative effects (cinematic particles, panel sheen).
 * 'full'   — always animate (default; premium look).
 * 'system' — honor `prefers-reduced-motion`.
 * Default is 'full' because WebKitGTK (Tauri desktop) reports `prefers-reduced-motion: reduce`
 * from the GTK "enable animations" setting, which falsely disabled all ambient effects on the
 * desktop app while Chromium (web) reported `no-preference`. The toggle lets reduced-motion
 * users opt back to 'system'.
 */
export type MotionMode = 'full' | 'system'

export type ParticleSpeedMode = 'zero-g' | 'normal' | 'hyper' | 'reverse'
export type ParticleColorMode = 'gold' | 'cyan' | 'violet' | 'silver'

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
  motionMode: MotionMode
  setMotionMode: (mode: MotionMode) => void
  particleSpeedMode: ParticleSpeedMode
  particleColorMode: ParticleColorMode
  setParticleSpeedMode: (mode: ParticleSpeedMode) => void
  setParticleColorMode: (mode: ParticleColorMode) => void
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
  motionMode: 'full',
  setMotionMode: (mode) => set({ motionMode: mode }),
  particleSpeedMode: 'normal',
  particleColorMode: 'gold',
  setParticleSpeedMode: (mode) => set({ particleSpeedMode: mode }),
  setParticleColorMode: (mode) => set({ particleColorMode: mode }),
})
