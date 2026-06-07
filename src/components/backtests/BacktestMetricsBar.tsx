import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import type { BacktestMetrics } from '@/types/backtesting'

const metricCardClass = 'rounded-lg border border-carbon-600/40 bg-transparent p-4'

type BacktestMetricsBarProps = {
  metrics: BacktestMetrics
}

export function BacktestMetricsBar({ metrics }: BacktestMetricsBarProps) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className={metricCardClass}>
        <h4 className="text-silver-400 text-sm font-medium">Total PnL</h4>
        <p
          className={`mt-1 text-2xl font-bold tabular-nums ${metrics.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {formatSignedCurrency(metrics.total_pnl)}
        </p>
      </div>
      <div className={metricCardClass}>
        <h4 className="text-silver-400 text-sm font-medium">Win Rate</h4>
        <p className="text-silver-100 mt-1 text-2xl font-bold">
          {(metrics.win_rate * 100).toFixed(1)}%
        </p>
      </div>
      <div className={metricCardClass}>
        <h4 className="text-silver-400 text-sm font-medium">Total Trades</h4>
        <p className="text-silver-100 mt-1 text-2xl font-bold">{metrics.total_trades}</p>
      </div>
      <div className={metricCardClass}>
        <h4 className="text-silver-400 text-sm font-medium">Max Drawdown</h4>
        <p className="mt-1 text-2xl font-bold text-rose-400">
          -{(metrics.max_drawdown_pct * 100).toFixed(2)}%
        </p>
      </div>
    </div>
  )
}
