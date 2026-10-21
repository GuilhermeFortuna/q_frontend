import type { DrawingAnchor } from '@/components/charts/drawings/model'

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
 * Measures the span between two anchors. `positionOfTime` maps an instant to its bar position
 * (see `timeMapping.ts`), so the candle count agrees with where the ruler is drawn.
 */
export function measureRuler(
  start: DrawingAnchor,
  end: DrawingAnchor,
  positionOfTime: (time: number) => number,
): RulerMeasurement {
  const priceDelta = end.price - start.price
  return {
    priceDelta,
    percentDelta: start.price !== 0 ? (priceDelta / start.price) * 100 : 0,
    bars: Math.round(Math.abs(positionOfTime(end.time) - positionOfTime(start.time))),
    durationMs: Math.abs(end.time - start.time),
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
