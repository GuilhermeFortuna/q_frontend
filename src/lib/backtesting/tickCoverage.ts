import type { BacktestRequest } from '@/types/backtesting'

export type TickPeriod = { start: string; end: string }

export type TickCoverage =
  | { status: 'unneeded' | 'unknown' | 'covered' }
  | { status: 'clamped'; symbol: string; requested: TickPeriod; used: TickPeriod }

/** Whether the request replays historical ticks (tick engine or intrabar Breakeven Stop). */
export function requiresTickData(request: BacktestRequest): boolean {
  if (request.engine === 'tick') return true
  const trigger = Number(request.exit_params?.breakeven_trigger_pct ?? 0)
  return Number.isFinite(trigger) && trigger > 0
}

/**
 * Compare the requested period with the tick history the data provider can serve.
 *
 * The requested end is capped at `now`: ticks cannot exist in the future, so a
 * selection that runs past the present (such as the default end of today) is not
 * a gap in history.
 *
 * Never blocks a run: with no inventory entry the request is left untouched,
 * and a selection outside the envelope falls back to the whole tick period.
 */
export function resolveTickCoverage(
  request: BacktestRequest,
  ticks: Pick<TickPeriod, 'start' | 'end'> | undefined,
  now: number = Date.now(),
): TickCoverage {
  if (!requiresTickData(request)) return { status: 'unneeded' }
  if (!ticks) return { status: 'unknown' }

  if (!request.start || !request.end) return { status: 'unknown' }

  const reqStart = Date.parse(request.start)
  const reqEnd = Math.min(Date.parse(request.end), now)
  const tickStart = Date.parse(ticks.start)
  const tickEnd = Date.parse(ticks.end)
  if ([reqStart, reqEnd, tickStart, tickEnd].some(Number.isNaN)) return { status: 'unknown' }

  if (reqStart >= tickStart && reqEnd <= tickEnd) return { status: 'covered' }

  const disjoint = reqEnd < tickStart || reqStart > tickEnd
  const start = disjoint ? tickStart : Math.max(reqStart, tickStart)
  const end = disjoint ? tickEnd : Math.min(reqEnd, tickEnd)
  return {
    status: 'clamped',
    symbol: request.symbol,
    requested: { start: request.start, end: request.end },
    used: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
  }
}
