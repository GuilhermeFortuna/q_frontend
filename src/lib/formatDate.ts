import { parseISO } from 'date-fns'

/** All user-facing timestamps are shown in Brasília (B3 / MT5 broker) time. */
export const DISPLAY_TIMEZONE = 'America/Sao_Paulo'

const NAIVE_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const TIMEZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (NAIVE_ISO_PATTERN.test(trimmed) && !TIMEZONE_SUFFIX_PATTERN.test(trimmed)) {
      return parseISO(`${trimmed}-03:00`)
    }
    return parseISO(trimmed)
  }
  return new Date(value)
}

type DateTimePart = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'

function getPart(date: Date, part: DateTimePart): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const value = parts.find((entry) => entry.type === part)?.value ?? ''
  if (part === 'hour' && value === '24') {
    return '00'
  }
  return value
}

function pad2(value: string): string {
  return value.padStart(2, '0')
}

function formatInDisplayZone(
  value: Date | string | number,
  include: { date?: boolean; time?: boolean; seconds?: boolean; monthOnly?: boolean },
): string {
  const date = toDate(value)
  const year = getPart(date, 'year')
  const month = pad2(getPart(date, 'month'))
  const day = pad2(getPart(date, 'day'))
  const hour = pad2(getPart(date, 'hour'))
  const minute = pad2(getPart(date, 'minute'))
  const second = pad2(getPart(date, 'second'))

  if (include.monthOnly) {
    return `${year}/${month}`
  }

  const datePart = `${year}/${month}/${day}`

  if (!include.time) {
    return datePart
  }

  const timePart = include.seconds ? `${hour}:${minute}:${second}` : `${hour}:${minute}`

  return include.date === false ? timePart : `${datePart} ${timePart}`
}

/** Date only: YYYY/MM/DD */
export function formatDisplayDate(value: Date | string | number): string {
  return formatInDisplayZone(value, { date: true })
}

/** Date and time: YYYY/MM/DD HH:mm:ss */
export function formatDisplayDateTime(value: Date | string | number): string {
  return formatInDisplayZone(value, { date: true, time: true, seconds: true })
}

/** Month bucket label: YYYY/MM */
export function formatDisplayMonth(value: Date | string | number): string {
  return formatInDisplayZone(value, { monthOnly: true })
}

/** Time only for intraday charts: HH:mm */
export function formatDisplayTime(value: Date | string | number): string {
  return formatInDisplayZone(value, { date: false, time: true })
}

/** Time with seconds for live quotes and tape: HH:mm:ss */
export function formatDisplayTimeSeconds(value: Date | string | number): string {
  return formatInDisplayZone(value, { date: false, time: true, seconds: true })
}

/** Month key for aggregation buckets: YYYY-MM */
export function formatDisplayMonthKey(value: Date | string | number): string {
  const date = toDate(value)
  const year = getPart(date, 'year')
  const month = pad2(getPart(date, 'month'))
  return `${year}-${month}`
}
