import { format } from 'date-fns'

import type { EquityPoint, MonthlyStats, Trade } from '@/types/backtesting'

function getClosedTrades(trades: Trade[]): Trade[] {
  return trades.filter((t) => t.status === 'CLOSED' && t.exit_time != null && t.pnl != null)
}

function sortByExitTime(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const ta = a.exit_time ? new Date(a.exit_time).getTime() : 0
    const tb = b.exit_time ? new Date(b.exit_time).getTime() : 0
    return ta - tb
  })
}

export function buildEquityCurve(trades: Trade[], initialCapital: number): EquityPoint[] {
  const closed = sortByExitTime(getClosedTrades(trades))
  if (closed.length === 0) return []

  let equity = initialCapital
  let peak = initialCapital
  const points: EquityPoint[] = []

  for (const trade of closed) {
    const pnl = trade.pnl ?? 0
    equity += pnl
    if (equity > peak) peak = equity
    const drawdown = peak - equity
    const drawdownPct = peak > 0 ? drawdown / peak : 0

    points.push({
      timestamp: trade.exit_time!,
      equity,
      pnl,
      drawdown,
      drawdownPct,
    })
  }

  return points
}

export function aggregateMonthlyStats(trades: Trade[]): MonthlyStats[] {
  const closed = getClosedTrades(trades)
  const byMonth = new Map<string, { pnl: number; wins: number; losses: number; trades: number }>()

  for (const trade of closed) {
    const exitTime = trade.exit_time!
    const month = format(new Date(exitTime), 'yyyy-MM')
    const pnl = trade.pnl ?? 0
    const existing = byMonth.get(month) ?? { pnl: 0, wins: 0, losses: 0, trades: 0 }
    existing.pnl += pnl
    existing.trades += 1
    if (pnl > 0) existing.wins += 1
    else existing.losses += 1
    byMonth.set(month, existing)
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, stats]) => ({
      month,
      label: format(new Date(`${month}-01T00:00:00Z`), 'MMM yyyy'),
      pnl: stats.pnl,
      trades: stats.trades,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.trades > 0 ? stats.wins / stats.trades : 0,
    }))
}
