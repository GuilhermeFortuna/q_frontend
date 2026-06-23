export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
  enableMsw: import.meta.env.VITE_ENABLE_MSW !== 'false' && import.meta.env.MODE === 'development',
  isDev: import.meta.env.DEV,
  /** Opt-in perf HUD + collectors via VITE_PERF_HUD=true (off by default in prod). */
  perfHud: import.meta.env.VITE_PERF_HUD === 'true',
} as const
