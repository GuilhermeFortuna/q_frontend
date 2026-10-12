/**
 * Place a series on the chart's bars by instant, not by text, so two spellings of the same
 * moment (`…:00Z`, `…:00.000Z`) still join. A bar the series does not cover is `null`.
 */
export function alignSeriesValuesToBars(
  barTimestamps: string[],
  responseTimestamps: string[],
  values: (number | null)[],
): (number | null)[] {
  const byInstant = new Map<number, number | null>()
  responseTimestamps.forEach((timestamp, index) => {
    byInstant.set(Date.parse(timestamp), values[index] ?? null)
  })
  return barTimestamps.map((timestamp) => byInstant.get(Date.parse(timestamp)) ?? null)
}

export function barRangeForSeries(
  bars: { timestamp: string }[],
): { start: string; end: string } | null {
  if (bars.length === 0) return null
  return { start: bars[0].timestamp, end: bars[bars.length - 1].timestamp }
}
