const enableMsw =
  import.meta.env.VITE_ENABLE_MSW !== 'false' && import.meta.env.MODE === 'development'

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
  enableMsw,
  enableStream: import.meta.env.VITE_ENABLE_STREAM !== 'false' && !enableMsw,
  isDev: import.meta.env.DEV,
  /** Opt-in perf HUD + collectors via VITE_PERF_HUD=true (off by default in prod). */
  perfHud: import.meta.env.VITE_PERF_HUD === 'true',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN ?? '',
  sentryEnvironment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'local',
  sentryTracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.2),
  sentryRelease: import.meta.env.VITE_SENTRY_RELEASE ?? '',
} as const
