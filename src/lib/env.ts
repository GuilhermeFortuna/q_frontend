export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
  enableMsw: import.meta.env.VITE_ENABLE_MSW !== 'false' && import.meta.env.MODE === 'development',
  isDev: import.meta.env.DEV,
} as const
