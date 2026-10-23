import { formatCurrency, formatSignedCurrency } from '@/components/backtests/chartUtils'
import { formatHoldTime } from '@/lib/backtesting/backtestMetricFormatters'
import type { BacktestPerformance, TradeStats } from '@/types/backtesting'

export type PerformanceSide = 'all' | 'long' | 'short'
export type MetricTone = 'positive' | 'negative' | 'neutral'

export type PerformanceMetricRow = {
  label: string
  value: string
  tone: MetricTone
  tooltip: string
}

export type PerformanceMetricGroup = {
  title: string
  description: string
  rows: PerformanceMetricRow[]
}

function numberOrDash(value: number | null, digits = 2): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

function percent(value: number | null, signed = false): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const scaled = value * 100
  return `${signed && scaled > 0 ? '+' : ''}${scaled.toFixed(2)}%`
}

function drawdownPercent(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : `-${(Math.abs(value) * 100).toFixed(2)}%`
}

function signedMoney(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : formatSignedCurrency(value)
}

function money(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : formatCurrency(Math.abs(value))
}

function ratio(value: number | null): string {
  return numberOrDash(value)
}

function toneFor(value: number | null, inverted = false): MetricTone {
  if (value == null || value === 0 || !Number.isFinite(value)) return 'neutral'
  return value > 0 !== inverted ? 'positive' : 'negative'
}

function row(
  label: string,
  value: string,
  tooltip: string,
  tone: MetricTone = 'neutral',
): PerformanceMetricRow {
  return { label, value, tooltip, tone }
}

function tradeRows(stats: TradeStats): PerformanceMetricRow[] {
  const factor =
    stats.profit_factor == null
      ? stats.winning > 0 && stats.losing === 0
        ? '∞'
        : '—'
      : ratio(stats.profit_factor)

  return [
    row('Trades', String(stats.total), 'Number of closed trades in this side group.'),
    row('Win rate', percent(stats.win_rate), 'Winning trades divided by total closed trades.'),
    row(
      'W / L / BE',
      `${stats.winning} / ${stats.losing} / ${stats.breakeven}`,
      'Winning, losing, and breakeven trades. Breakeven trades are included in losing.',
    ),
    row(
      'Profit factor',
      factor,
      'Gross profit divided by the absolute value of gross loss.',
      toneFor(stats.profit_factor),
    ),
    row(
      'Expectancy',
      signedMoney(stats.expectancy),
      'Mean P&L per closed trade.',
      toneFor(stats.expectancy),
    ),
    row('Average win', money(stats.avg_win), 'Mean P&L of winning trades.', toneFor(stats.avg_win)),
    row(
      'Average loss',
      signedMoney(stats.avg_loss),
      'Mean P&L of losing trades.',
      toneFor(stats.avg_loss),
    ),
    row(
      'Payoff ratio',
      ratio(stats.payoff_ratio),
      'Average win divided by the absolute average loss.',
    ),
    row(
      'Largest win',
      money(stats.largest_win),
      'Largest positive P&L from one closed trade.',
      toneFor(stats.largest_win),
    ),
    row(
      'Largest loss',
      signedMoney(stats.largest_loss),
      'Lowest P&L from one closed trade.',
      toneFor(stats.largest_loss),
    ),
    row(
      'Max consecutive wins',
      String(stats.max_consecutive_wins),
      'Longest winning streak in exit order.',
    ),
    row(
      'Max consecutive losses',
      String(stats.max_consecutive_losses),
      'Longest losing streak in exit order.',
    ),
    row(
      'Average hold',
      formatHoldTime(stats.avg_hold_seconds),
      'Mean time between entry and exit.',
    ),
    row(
      'Average winning hold',
      formatHoldTime(stats.avg_win_hold_seconds),
      'Mean time between entry and exit for winners.',
    ),
    row(
      'Average losing hold',
      formatHoldTime(stats.avg_loss_hold_seconds),
      'Mean time between entry and exit for losers.',
    ),
  ]
}

export function buildPerformanceMetricGroups(
  performance: BacktestPerformance,
  side: PerformanceSide,
): PerformanceMetricGroup[] {
  const p = performance.portfolio
  const returns = [
    row(
      'Net P&L',
      signedMoney(p.net_pnl),
      'Sum of closed-trade P&L after transaction costs.',
      toneFor(p.net_pnl),
    ),
    row(
      'Return',
      percent(p.return_pct, true),
      'Net P&L divided by initial capital.',
      toneFor(p.return_pct),
    ),
    row(
      'CAGR',
      percent(p.cagr_pct, true),
      'Annualized compound return over the run span.',
      toneFor(p.cagr_pct),
    ),
    row(
      'Gross profit',
      money(p.gross_profit),
      'Sum of positive closed-trade P&L.',
      toneFor(p.gross_profit),
    ),
    row(
      'Gross loss',
      signedMoney(p.gross_loss),
      'Sum of non-positive closed-trade P&L.',
      toneFor(p.gross_loss),
    ),
    row(
      'Commission',
      signedMoney(-p.total_commission),
      'Total commission charged on closed trades.',
      toneFor(-p.total_commission),
    ),
    row(
      'Trades per month',
      numberOrDash(p.trades_per_month),
      'Closed trades per 30.4375 days of run span.',
    ),
  ]
  const risk = [
    row(
      'Max drawdown',
      drawdownPercent(p.max_drawdown_pct),
      'Largest peak-to-trough fall as a fraction of the peak.',
      'negative',
    ),
    row(
      'Max drawdown value',
      signedMoney(-p.max_drawdown_value),
      'Largest peak-to-trough fall in account value.',
      'negative',
    ),
    row(
      'Longest drawdown',
      p.max_drawdown_duration_days == null
        ? '—'
        : `${p.max_drawdown_duration_days.toFixed(1)} days`,
      'Longest peak-to-recovery span; unrecovered periods run to the end.',
    ),
    row(
      'Average drawdown',
      drawdownPercent(p.avg_drawdown_pct),
      'Mean depth across drawdown periods.',
      'negative',
    ),
    row(
      'Recovery factor',
      ratio(p.recovery_factor),
      'Net P&L divided by maximum drawdown value.',
      toneFor(p.recovery_factor),
    ),
    row(
      'Calmar',
      ratio(p.calmar_ratio),
      'CAGR divided by maximum drawdown percentage.',
      toneFor(p.calmar_ratio),
    ),
    row(
      'Sharpe',
      ratio(p.sharpe_ratio),
      'Annualized mean daily return divided by daily return deviation.',
      toneFor(p.sharpe_ratio),
    ),
    row(
      'Sortino',
      ratio(p.sortino_ratio),
      'Annualized mean daily return divided by downside deviation.',
      toneFor(p.sortino_ratio),
    ),
    row(
      'Annual volatility',
      percent(p.annual_volatility_pct),
      'Standard deviation of daily returns times the square root of 252.',
    ),
    row(
      'Time in market',
      percent(p.time_in_market_pct),
      'Share of the run span covered by at least one open trade.',
    ),
  ]

  return [
    {
      title: 'Returns',
      description: `Portfolio-wide · Closed-trade equity · daily · ${performance.basis.periods_per_year}/yr · rf ${performance.basis.risk_free_rate}`,
      rows: returns,
    },
    { title: 'Risk', description: 'Portfolio-wide', rows: risk },
    {
      title: 'Trade quality',
      description: 'By closed-trade side',
      rows: tradeRows(performance.trades[side]),
    },
  ]
}
