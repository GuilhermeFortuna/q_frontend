import { formatDisplayMonth, formatDisplayMonthKey } from '@/lib/formatDate'

import type { EquityPoint, MonthlyStats, MonthlySummary, Trade } from '@/types/backtesting'

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
    const month = formatDisplayMonthKey(exitTime)
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
      label: formatDisplayMonth(new Date(`${month}-01T00:00:00Z`)),
      pnl: stats.pnl,
      trades: stats.trades,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.trades > 0 ? stats.wins / stats.trades : 0,
    }))
}

/** Zero-based month number, so that consecutive `YYYY-MM` keys differ by exactly 1. */
function monthIndex(month: string): number {
  const [year, monthOfYear] = month.split('-').map(Number)
  return year * 12 + (monthOfYear - 1)
}

/**
 * Longest run of consecutive calendar months whose PnL is strictly positive (`direction` 1)
 * or strictly negative (`direction` -1). A flat month or a month with no trades ends the run.
 */
function longestMonthlyStreak(monthlyStats: MonthlyStats[], direction: 1 | -1): number {
  let longest = 0
  let current = 0
  let previousIndex: number | null = null

  for (const stat of monthlyStats) {
    const index = monthIndex(stat.month)
    const qualifies = stat.pnl * direction > 0
    const contiguous = previousIndex !== null && index === previousIndex + 1
    current = qualifies ? (contiguous ? current + 1 : 1) : 0
    longest = Math.max(longest, current)
    previousIndex = index
  }

  return longest
}

export function summarizeMonthlyStats(monthlyStats: MonthlyStats[]): MonthlySummary | null {
  if (monthlyStats.length === 0) return null

  const totalMonths = monthlyStats.length
  const positiveMonths = monthlyStats.filter((m) => m.pnl > 0).length
  const negativeMonths = monthlyStats.filter((m) => m.pnl < 0).length
  const totalPnl = monthlyStats.reduce((sum, m) => sum + m.pnl, 0)
  const totalTrades = monthlyStats.reduce((sum, m) => sum + m.trades, 0)

  const sortedPnl = monthlyStats.map((m) => m.pnl).sort((a, b) => a - b)
  const mid = Math.floor(sortedPnl.length / 2)
  const medianPnl =
    sortedPnl.length % 2 === 0 ? (sortedPnl[mid - 1] + sortedPnl[mid]) / 2 : sortedPnl[mid]

  const best = monthlyStats.reduce((a, b) => (b.pnl > a.pnl ? b : a))
  const worst = monthlyStats.reduce((a, b) => (b.pnl < a.pnl ? b : a))

  return {
    totalMonths,
    positiveMonths,
    negativeMonths,
    flatMonths: totalMonths - positiveMonths - negativeMonths,
    positiveMonthRate: positiveMonths / totalMonths,
    averagePnl: totalPnl / totalMonths,
    medianPnl,
    bestMonth: { label: best.label, pnl: best.pnl },
    worstMonth: { label: worst.label, pnl: worst.pnl },
    longestWinStreak: longestMonthlyStreak(monthlyStats, 1),
    longestLossStreak: longestMonthlyStreak(monthlyStats, -1),
    averageTradesPerMonth: totalTrades / totalMonths,
  }
}
