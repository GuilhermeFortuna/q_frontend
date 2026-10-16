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

/** Remap study-relative segment starts onto chart bar indices. */
export function alignSegmentStartIndexToBars(
  barTimestamps: string[],
  studyTimestamps: string[],
  startIndex: (number | null)[],
): (number | null)[] {
  const chartIndexByInstant = new Map(
    barTimestamps.map((timestamp, index) => [Date.parse(timestamp), index]),
  )
  const endByInstant = new Map<number, number | null>()
  studyTimestamps.forEach((timestamp, studyIdx) => {
    const rawStart = startIndex[studyIdx]
    let chartStart: number | null = null
    if (rawStart != null && rawStart >= 0 && rawStart < studyTimestamps.length) {
      chartStart = chartIndexByInstant.get(Date.parse(studyTimestamps[rawStart])) ?? null
    }
    endByInstant.set(Date.parse(timestamp), chartStart)
  })
  return barTimestamps.map((timestamp) => endByInstant.get(Date.parse(timestamp)) ?? null)
}

export function barRangeForSeries(
  bars: { timestamp: string }[],
): { start: string; end: string } | null {
  if (bars.length === 0) return null
  return { start: bars[0].timestamp, end: bars[bars.length - 1].timestamp }
}
