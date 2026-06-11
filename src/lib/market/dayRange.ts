export function computeDayRangeMarkerPosition(
  last: number,
  dayLow: number,
  dayHigh: number,
): number {
  if (dayHigh === dayLow) {
    return 50
  }

  const position = ((last - dayLow) / (dayHigh - dayLow)) * 100
  return Math.min(100, Math.max(0, position))
}
