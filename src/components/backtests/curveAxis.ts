import { formatChartDate } from '@/components/backtests/chartUtils'
import type { EquityPoint } from '@/types/backtesting'

/**
 * X-axis mode shared by the Equity and Drawdown curves.
 * - `time`: wall-clock position, so flat stretches (stagnation) and recoveries read as elapsed time.
 * - `trades`: one step per closed trade, so every trade has equal horizontal weight.
 */
export type CurveXMode = 'time' | 'trades'

export const CURVE_X_MODE_OPTIONS: { value: CurveXMode; label: string }[] = [
  { value: 'time', label: 'Time' },
  { value: 'trades', label: 'Trades' },
]

export type CurvePoint = EquityPoint & { x: number }

export function toCurvePoints(data: EquityPoint[], xMode: CurveXMode): CurvePoint[] {
  return data.map((point, index) => ({
    ...point,
    x: xMode === 'trades' ? index + 1 : new Date(point.timestamp).getTime(),
  }))
}

/**
 * Maps a timestamp (peak, recovery, window boundary) onto the active X axis.
 * In trade mode it resolves to the first trade closed at or after the timestamp.
 */
export function timestampToX(timestamp: string, data: EquityPoint[], xMode: CurveXMode): number {
  const time = new Date(timestamp).getTime()
  if (xMode === 'time') return time
  const index = data.findIndex((point) => new Date(point.timestamp).getTime() >= time)
  return index === -1 ? data.length : index + 1
}

export function formatCurveXTick(xMode: CurveXMode) {
  return (value: number) =>
    xMode === 'trades' ? `#${value}` : formatChartDate(new Date(value).toISOString())
}
