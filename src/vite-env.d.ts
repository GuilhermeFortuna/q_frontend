/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ENABLE_MSW?: string
  readonly VITE_PERF_HUD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** WO96/WO101 — dev-only perf snapshot for smoke scripts. */
  __Q_PERF_SNAPSHOT__?: () => import('@/lib/performance/performanceMonitor').PerformanceSnapshot
}

declare const __GIT_SHA__: string
