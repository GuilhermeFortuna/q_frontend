import type { OhlcvBar } from '@/types/api'

export function alignSeriesValuesToBars(
  barTimestamps: string[],
  responseTimestamps: string[],
  values: (number | null)[],
): (number | null)[] {
  const byTime = new Map<string, number | null>()
  responseTimestamps.forEach((timestamp, index) => {
    byTime.set(timestamp, values[index] ?? null)
  })
  return barTimestamps.map((timestamp) => (byTime.has(timestamp) ? byTime.get(timestamp)! : null))
}

export function barRangeForSeries(bars: OhlcvBar[]): { start: string; end: string } | null {
  if (bars.length === 0) return null
  return { start: bars[0].timestamp, end: bars[bars.length - 1].timestamp }
}
