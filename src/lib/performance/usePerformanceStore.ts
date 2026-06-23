import { create } from 'zustand'

import { env } from '@/lib/env'
import {
  getPerformanceMonitor,
  INITIAL_SNAPSHOT,
  type PerformanceSnapshot,
} from '@/lib/performance/performanceMonitor'

type PerformanceStore = PerformanceSnapshot & {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  syncFromMonitor: (snapshot: PerformanceSnapshot) => void
}

export const usePerformanceStore = create<PerformanceStore>((set) => ({
  ...INITIAL_SNAPSHOT,
  enabled: env.perfHud,
  setEnabled: (enabled) => set({ enabled }),
  syncFromMonitor: (snapshot) => set(snapshot),
}))

let monitorSubscription: (() => void) | null = null

export function startPerformanceCollection(): () => void {
  if (!env.perfHud) {
    return () => undefined
  }

  const monitor = getPerformanceMonitor()
  monitor.start()

  if (!monitorSubscription) {
    monitorSubscription = monitor.subscribe((snapshot) => {
      usePerformanceStore.getState().syncFromMonitor(snapshot)
    })
  }

  return () => {
    monitorSubscription?.()
    monitorSubscription = null
    monitor.stop()
  }
}
