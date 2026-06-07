import { format } from 'date-fns'

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/** Date only: YYYY/MM/DD */
export function formatDisplayDate(value: Date | string | number): string {
  return format(toDate(value), 'yyyy/MM/dd')
}

/** Date and time: YYYY/MM/DD HH:mm:ss */
export function formatDisplayDateTime(value: Date | string | number): string {
  return format(toDate(value), 'yyyy/MM/dd HH:mm:ss')
}

/** Month bucket label: YYYY/MM */
export function formatDisplayMonth(value: Date | string | number): string {
  return format(toDate(value), 'yyyy/MM')
}

/** Time only for intraday charts: HH:mm */
export function formatDisplayTime(value: Date | string | number): string {
  return format(toDate(value), 'HH:mm')
}
