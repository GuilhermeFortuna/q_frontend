import { differenceInCalendarDays } from 'date-fns'

/** Mirrors backend `split_windows` window count for client-side hints. */
export function estimateWalkForwardWindowCount(
  start: Date,
  end: Date,
  trainDays: number,
  testDays: number,
): number {
  const rangeDays = differenceInCalendarDays(end, start)
  if (rangeDays <= trainDays || testDays < 1 || trainDays < 1) {
    return 0
  }

  let count = 0
  let index = 0
  while (true) {
    const testStartOffset = trainDays + index * testDays
    if (testStartOffset >= rangeDays) {
      break
    }
    const testSpan = Math.min(testDays, rangeDays - testStartOffset)
    if (testSpan < 1) {
      break
    }
    count += 1
    index += 1
  }
  return count
}
