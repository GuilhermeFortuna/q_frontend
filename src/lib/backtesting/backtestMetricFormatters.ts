import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import type { BacktestMetrics } from '@/types/backtesting'

export function formatTeaserNetProfit(metrics: BacktestMetrics): string {
  return formatSignedCurrency(metrics.total_pnl)
}

export function formatTeaserWinRate(metrics: BacktestMetrics): string {
  return `${(metrics.win_rate * 100).toFixed(1)}%`
}

export function formatTeaserMaxDrawdown(metrics: BacktestMetrics): string {
  return `-${(metrics.max_drawdown_pct * 100).toFixed(2)}%`
}

export function formatTeaserTradeCount(metrics: BacktestMetrics): string {
  return String(metrics.total_trades)
}

export function formatHoldTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const totalMinutes = Math.max(0, Math.floor(seconds / 60))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days) return `${days}d${hours ? ` ${hours}h` : ''}`
  if (hours) return `${hours}h${minutes ? ` ${minutes}m` : ''}`
  return `${minutes}m`
}
