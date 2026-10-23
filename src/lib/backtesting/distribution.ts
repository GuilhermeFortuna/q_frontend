import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import { formatDisplayWeekday, getDisplayHour } from '@/lib/formatDate'
import type { Trade } from '@/types/backtesting'

export type RollingTradeStatPoint = {
  timestamp: string
  exitTime: string
  win_rate: number
  winRate: number
  expectancy: number
  profit_factor: number | null
  profitFactor: number | null
  total_pnl: number
}

export type HistogramBin = {
  x0: number
  x1: number
  count: number
  share: number
  tone: 'positive' | 'negative'
  label: string
}

export type PnlHistogramResult = {
  bins: HistogramBin[]
  mean: number | null
  median: number | null
  totalTrades: number
}

export type HoldVsPnlPoint = {
  id: string
  tradeId: string
  side: 'BUY' | 'SELL'
  action: 'BUY' | 'SELL'
  entryTime: string
  exitTime: string
  duration: number
  durationSeconds: number
  pnl: number
  tone: 'positive' | 'negative'
}

export type TimeBreakdownBucket = {
  key: string
  label: string
  pnl: number
  trades: number
  wins: number
  losses: number
  winRate: number
  hour?: number
}

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

function computeQuantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  }
  return sorted[base]
}

/**
 * Computes rolling statistics (win rate, profit factor, expectancy)
 * over the last N closed trades in exit order.
 */
export function rollingTradeStats(trades: Trade[], window: number): RollingTradeStatPoint[] {
  if (window <= 0) return []
  const closed = sortByExitTime(getClosedTrades(trades))
  if (closed.length < window) return []

  const points: RollingTradeStatPoint[] = []

  for (let i = window - 1; i < closed.length; i++) {
    const slice = closed.slice(i - window + 1, i + 1)
    let wins = 0
    let totalPnl = 0
    let grossProfit = 0
    let grossLoss = 0

    for (const trade of slice) {
      const pnl = trade.pnl ?? 0
      totalPnl += pnl
      if (pnl > 0) {
        wins++
        grossProfit += pnl
      } else if (pnl < 0) {
        grossLoss += pnl
      }
    }

    const winRate = wins / window
    const expectancy = totalPnl / window
    const profitFactor = grossLoss === 0 ? null : grossProfit / Math.abs(grossLoss)
    const lastTrade = closed[i]

    points.push({
      timestamp: lastTrade.exit_time!,
      exitTime: lastTrade.exit_time!,
      win_rate: winRate,
      winRate,
      expectancy,
      profit_factor: profitFactor,
      profitFactor,
      total_pnl: totalPnl,
    })
  }

  return points
}

/**
 * Generates P&L distribution histogram with Freedman-Diaconis bin width clamped to 10–40 bins.
 * Bin edges never span zero (0 is always a boundary).
 */
export function pnlHistogram(trades: Trade[]): PnlHistogramResult {
  const closed = getClosedTrades(trades)
  if (closed.length === 0) {
    return {
      bins: [],
      mean: null,
      median: null,
      totalTrades: 0,
    }
  }

  const values = closed.map((t) => t.pnl!).sort((a, b) => a - b)
  const n = values.length
  const totalPnl = values.reduce((sum, v) => sum + v, 0)
  const mean = totalPnl / n
  const mid = Math.floor(n / 2)
  const median = n % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]

  const min = values[0]
  const max = values[n - 1]

  const q1 = computeQuantile(values, 0.25)
  const q3 = computeQuantile(values, 0.75)
  const iqr = q3 - q1

  // Freedman-Diaconis bin width: h = 2 * IQR / n^(1/3)
  const fdWidth = n > 1 && iqr > 0 ? (2 * iqr) / Math.cbrt(n) : 0

  const spanNeg = min < 0 ? Math.abs(min) : 0
  const spanPos = max > 0 ? max : 0
  const totalSpan = spanNeg + spanPos || 1

  const countBins = (w: number) => {
    const bNeg = spanNeg > 0 ? Math.ceil(spanNeg / w) : 0
    const bPos = spanPos > 0 ? Math.ceil(spanPos / w) : 0
    return Math.max(1, bNeg + bPos)
  }

  let w: number
  if (fdWidth > 0) {
    const rawBins = countBins(fdWidth)
    if (rawBins < 10) {
      w = totalSpan / 10
      while (countBins(w) < 10) {
        w *= 0.9
      }
    } else if (rawBins > 40) {
      w = totalSpan / 40
      while (countBins(w) > 40) {
        w *= 1.05
      }
    } else {
      w = fdWidth
    }
  } else {
    w = totalSpan / 20
    while (countBins(w) < 10) w *= 0.9
    while (countBins(w) > 40) w *= 1.05
  }

  let finalNeg = spanNeg > 0 ? Math.ceil(spanNeg / w) : 0
  let finalPos = spanPos > 0 ? Math.ceil(spanPos / w) : 0

  if (finalNeg + finalPos === 0) {
    finalPos = 10
    w = 1
  } else if (finalNeg + finalPos < 10) {
    if (finalNeg === 0) finalPos = 10
    else if (finalPos === 0) finalNeg = 10
    else {
      while (finalNeg + finalPos < 10) {
        w *= 0.9
        finalNeg = Math.ceil(spanNeg / w)
        finalPos = Math.ceil(spanPos / w)
      }
    }
  }

  while (finalNeg + finalPos > 40) {
    w *= 1.05
    finalNeg = spanNeg > 0 ? Math.ceil(spanNeg / w) : 0
    finalPos = spanPos > 0 ? Math.ceil(spanPos / w) : 0
  }

  const bins: HistogramBin[] = []

  // Negative bins: -finalNeg * w to 0
  for (let i = finalNeg; i >= 1; i--) {
    const x0 = -i * w
    const x1 = -(i - 1) * w
    bins.push({
      x0,
      x1,
      count: 0,
      share: 0,
      tone: 'negative',
      label: `${formatSignedCurrency(x0)} to ${formatSignedCurrency(x1)}`,
    })
  }

  // Positive bins: 0 to finalPos * w
  for (let i = 0; i < finalPos; i++) {
    const x0 = i * w
    const x1 = (i + 1) * w
    bins.push({
      x0,
      x1,
      count: 0,
      share: 0,
      tone: 'positive',
      label: `${formatSignedCurrency(x0)} to ${formatSignedCurrency(x1)}`,
    })
  }

  // Assign trades to bins
  for (const val of values) {
    if (val < 0) {
      let placed = false
      for (const bin of bins) {
        if (bin.tone === 'negative' && val >= bin.x0 && (val < bin.x1 || bin.x1 === 0)) {
          bin.count++
          placed = true
          break
        }
      }
      if (!placed && bins.length > 0) {
        bins[0].count++
      }
    } else {
      let placed = false
      for (let j = bins.length - 1; j >= 0; j--) {
        const bin = bins[j]
        if (bin.tone === 'positive' && val >= bin.x0 && (val < bin.x1 || j === bins.length - 1)) {
          bin.count++
          placed = true
          break
        }
      }
      if (!placed && bins.length > 0) {
        bins[bins.length - 1].count++
      }
    }
  }

  for (const bin of bins) {
    bin.share = n > 0 ? bin.count / n : 0
  }

  return {
    bins,
    mean,
    median,
    totalTrades: n,
  }
}

/**
 * Hold duration vs P&L scatter points.
 */
export function holdVsPnl(trades: Trade[]): HoldVsPnlPoint[] {
  const closed = getClosedTrades(trades).filter((t) => t.entry_time != null && t.exit_time != null)

  return closed.map((trade) => {
    const entryMs = new Date(trade.entry_time).getTime()
    const exitMs = new Date(trade.exit_time!).getTime()
    const duration = Math.max(0, (exitMs - entryMs) / 1000)
    const pnl = trade.pnl ?? 0

    return {
      id: trade.id,
      tradeId: trade.id,
      side: trade.action,
      action: trade.action,
      entryTime: trade.entry_time,
      exitTime: trade.exit_time!,
      duration,
      durationSeconds: duration,
      pnl,
      tone: pnl >= 0 ? 'positive' : 'negative',
    }
  })
}

/**
 * Breakdown of closed trades by weekday or entry hour in display timezone.
 */
export function breakdownBy(trades: Trade[], by: 'weekday' | 'hour'): TimeBreakdownBucket[] {
  const closed = getClosedTrades(trades).filter((t) => t.entry_time != null)

  if (by === 'weekday') {
    const baseDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    const hasSat = closed.some((t) => formatDisplayWeekday(t.entry_time) === 'Sat')
    const hasSun = closed.some((t) => formatDisplayWeekday(t.entry_time) === 'Sun')

    const days = [...baseDays]
    if (hasSat) days.push('Sat')
    if (hasSun) days.push('Sun')

    const statsMap = new Map<
      string,
      { pnl: number; trades: number; wins: number; losses: number }
    >()
    for (const day of days) {
      statsMap.set(day, { pnl: 0, trades: 0, wins: 0, losses: 0 })
    }

    for (const trade of closed) {
      const day = formatDisplayWeekday(trade.entry_time)
      const stats = statsMap.get(day)
      if (!stats) continue
      const pnl = trade.pnl ?? 0
      stats.pnl += pnl
      stats.trades += 1
      if (pnl > 0) stats.wins += 1
      else stats.losses += 1
    }

    return days.map((day) => {
      const stats = statsMap.get(day)!
      return {
        key: day,
        label: day,
        pnl: stats.pnl,
        trades: stats.trades,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.trades > 0 ? stats.wins / stats.trades : 0,
      }
    })
  }

  // by === 'hour'
  const hourMap = new Map<number, { pnl: number; trades: number; wins: number; losses: number }>()

  for (const trade of closed) {
    const hour = getDisplayHour(trade.entry_time)
    const existing = hourMap.get(hour) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 }
    const pnl = trade.pnl ?? 0
    existing.pnl += pnl
    existing.trades += 1
    if (pnl > 0) existing.wins += 1
    else existing.losses += 1
    hourMap.set(hour, existing)
  }

  const sortedHours = Array.from(hourMap.keys()).sort((a, b) => a - b)
  return sortedHours.map((hour) => {
    const stats = hourMap.get(hour)!
    const label = `${String(hour).padStart(2, '0')}:00`
    return {
      key: label,
      label,
      hour,
      pnl: stats.pnl,
      trades: stats.trades,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.trades > 0 ? stats.wins / stats.trades : 0,
    }
  })
}
