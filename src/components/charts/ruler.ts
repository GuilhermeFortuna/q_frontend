import type { DataPoint, ProcessedBar } from '@/components/charts/types/chart'

/** `hand` drags the chart; `ruler` measures between two points. Toggled with Ctrl. */
export type ChartMeasureMode = 'hand' | 'ruler'

export type RulerMeasurement = {
  priceDelta: number
  percentDelta: number
  /** Number of candles between the two points, regardless of direction. */
  bars: number
  durationMs: number
}

/**
 * Measures the span between two chart points. Both must sit on bars of `bars`
 * (the full processed series), otherwise there is nothing to measure.
 */
export function measureRuler(
  start: DataPoint,
  end: DataPoint,
  bars: ProcessedBar[],
): RulerMeasurement | null {
  const startBar = bars.find((bar) => bar.timestamp === start.timestamp)
  const endBar = bars.find((bar) => bar.timestamp === end.timestamp)
  if (!startBar || !endBar) return null

  const priceDelta = end.price - start.price
  return {
    priceDelta,
    percentDelta: start.price !== 0 ? (priceDelta / start.price) * 100 : 0,
    bars: Math.abs(endBar.index - startBar.index),
    durationMs: Math.abs(endBar.timeMs - startBar.timeMs),
  }
}

/** Compact span label: `45m`, `3h 20m` or `5d 4h`. */
export function formatRulerDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const remainingMinutes = minutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${remainingMinutes}m`
  return `${remainingMinutes}m`
}
