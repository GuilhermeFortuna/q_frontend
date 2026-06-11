import type { BacktestMetrics } from '@/types/backtesting'

/** Coerce walk-forward OOS summary metrics into BacktestMetricsBar shape. */
export function coerceBacktestMetrics(
  metrics: Record<string, number> | undefined,
): BacktestMetrics {
  const m = metrics ?? {}
  return {
    total_trades: m.total_trades ?? 0,
    total_pnl: m.total_pnl ?? 0,
    total_commission: m.total_commission,
    win_rate: m.win_rate ?? 0,
    winning_trades: m.winning_trades ?? 0,
    losing_trades: m.losing_trades ?? 0,
    max_drawdown_value: m.max_drawdown_value ?? 0,
    max_drawdown_pct: m.max_drawdown_pct ?? 0,
    profit_factor: m.profit_factor ?? 0,
    recovery_factor: m.recovery_factor ?? 0,
    expectancy: m.expectancy ?? 0,
    avg_win: m.avg_win ?? 0,
    avg_loss: m.avg_loss ?? 0,
    win_loss_ratio: m.win_loss_ratio ?? 0,
    max_consecutive_wins: m.max_consecutive_wins ?? 0,
    max_consecutive_losses: m.max_consecutive_losses ?? 0,
  }
}
