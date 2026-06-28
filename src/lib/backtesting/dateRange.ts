import { endOfDay, formatISO, startOfDay, startOfYear, subMonths } from 'date-fns'

import type { OhlcvAvailableRange } from '@/types/api'

export type DatePreset = '1M' | '3M' | '6M' | '1Y' | 'YTD'

export function getDateRangeFromPreset(preset: DatePreset): { start: Date; end: Date } {
  const end = endOfDay(new Date())
  let start: Date
  switch (preset) {
    case '1M':
      start = startOfDay(subMonths(end, 1))
      break
    case '3M':
      start = startOfDay(subMonths(end, 3))
      break
    case '6M':
      start = startOfDay(subMonths(end, 6))
      break
    case '1Y':
      start = startOfDay(subMonths(end, 12))
      break
    case 'YTD':
      start = startOfDay(startOfYear(end))
      break
  }
  return { start, end }
}

export const defaultBacktestStart = startOfDay(subMonths(new Date(), 12))
export const defaultBacktestEnd = endOfDay(new Date())

// Neural training needs out-of-sample bars *after* train_end for the IC gate
// (the backend requires >=100). Default the train window to end well before today
// so a first run leaves room to gate, instead of failing with "0 OOS bars".
export const defaultNeuralTrainStart = startOfDay(subMonths(new Date(), 24))
export const defaultNeuralTrainEnd = endOfDay(subMonths(new Date(), 6))

/** Map backend earliest bar to a backtest range ending today. */
export function getAllAvailableDateRange(earliestAvailable: string | Date): {
  start: Date
  end: Date
} {
  return {
    start: startOfDay(new Date(earliestAvailable)),
    end: endOfDay(new Date()),
  }
}

/** Merge multiple MT5 available-range probes into one download window. */
export function combineOhlcvAvailableRanges(
  ranges: OhlcvAvailableRange[],
): Pick<OhlcvAvailableRange, 'start' | 'end'> | null {
  if (ranges.length === 0) return null

  let start = ranges[0].start
  let end = ranges[0].end
  for (const range of ranges.slice(1)) {
    if (new Date(range.start) < new Date(start)) start = range.start
    if (new Date(range.end) > new Date(end)) end = range.end
  }
  return { start, end }
}

/** Map MT5 ISO timestamps to `<input type="date">` values for the Storage workspace. */
export function toStorageDateInputs(
  isoStart: string,
  isoEnd: string,
): { start: string; end: string } {
  return {
    start: formatISO(startOfDay(new Date(isoStart)), { representation: 'date' }),
    end: formatISO(endOfDay(new Date(isoEnd)), { representation: 'date' }),
  }
}
