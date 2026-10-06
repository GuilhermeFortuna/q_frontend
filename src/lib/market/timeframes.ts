import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from '@/lib/formatDate'

export const CHART_TIMEFRAMES = ['1m', '5m', '10m', '15m', '30m', '1H', '4H', '1D'] as const

export const RESEARCH_CANDLE_TIMEFRAME_OPTIONS = [
  { value: 'M1', label: '1 Minute' },
  { value: 'M5', label: '5 Minutes' },
  { value: 'M10', label: '10 Minutes' },
  { value: 'M15', label: '15 Minutes' },
  { value: 'H1', label: '1 Hour' },
  { value: 'D1', label: '1 Day' },
] as const

export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number]

const UI_TO_MT5: Record<string, string> = {
  '1m': 'M1',
  '5m': 'M5',
  '10m': 'M10',
  '15m': 'M15',
  '30m': 'M30',
  '1h': 'H1',
  '4h': 'H4',
  '1d': 'D1',
  M1: 'M1',
  M5: 'M5',
  M10: 'M10',
  M15: 'M15',
  M30: 'M30',
  H1: 'H1',
  H4: 'H4',
  D1: 'D1',
}

/** Map UI timeframe label to MT5/API timeframe code. */
export function toApiTimeframe(timeframe: string): string {
  return UI_TO_MT5[timeframe.toLowerCase()] ?? UI_TO_MT5[timeframe.toUpperCase()] ?? 'D1'
}

/** Bar duration in milliseconds for mock data generation. */
export function timeframeToMs(timeframe: string): number {
  const code = toApiTimeframe(timeframe)
  const map: Record<string, number> = {
    M1: 60_000,
    M5: 5 * 60_000,
    M10: 10 * 60_000,
    M15: 15 * 60_000,
    M30: 30 * 60_000,
    H1: 60 * 60_000,
    H4: 4 * 60 * 60_000,
    D1: 24 * 60 * 60_000,
  }
  return map[code] ?? map.D1
}

/** Whether timeframe is intraday (sub-daily). */
export function isIntradayTimeframe(timeframe: string): boolean {
  const code = toApiTimeframe(timeframe)
  return code !== 'D1'
}

/** Format timestamp for x-axis ticks. */
export function formatTimeAxisLabel(timestamp: string, timeframe: string): string {
  if (isIntradayTimeframe(timeframe)) {
    return formatDisplayTime(timestamp)
  }
  return formatDisplayDate(timestamp)
}

/** Format timestamp for crosshair / hover overlay labels. */
export function formatCrosshairLabel(timestamp: string, timeframe: string): string {
  if (isIntradayTimeframe(timeframe)) {
    return formatDisplayDateTime(timestamp)
  }
  return formatDisplayDate(timestamp)
}
