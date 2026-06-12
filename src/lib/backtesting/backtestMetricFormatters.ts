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
