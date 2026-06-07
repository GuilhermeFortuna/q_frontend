import { endOfDay, startOfDay, startOfYear, subMonths } from 'date-fns'

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
