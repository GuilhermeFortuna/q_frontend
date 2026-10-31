import { EXCHANGE_TIMEZONE } from '@/workspaces/replay/replayControls'

const EXCHANGE_FORMAT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: EXCHANGE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const UTC_FORMAT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Market instant in exchange-local time, e.g. `2026-10-01 09:15:00 BRT`. */
export function formatExchangeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const moment = new Date(iso)
  if (Number.isNaN(moment.getTime())) return '—'
  return `${EXCHANGE_FORMAT.format(moment)} BRT`
}

/** Market instant in UTC, e.g. `2026-10-01 12:15:00 UTC`. */
export function formatUtcTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const moment = new Date(iso)
  if (Number.isNaN(moment.getTime())) return '—'
  return `${UTC_FORMAT.format(moment)} UTC`
}

/** Exchange-local wall time of a session day, for the freeze and dataset lists. */
export function formatDayRange(startDay: string, endDay: string): string {
  return startDay === endDay ? startDay : `${startDay} → ${endDay}`
}
