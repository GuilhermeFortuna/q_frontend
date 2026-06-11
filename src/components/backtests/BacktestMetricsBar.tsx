import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import type { BacktestMetrics } from '@/types/backtesting'

const metricCardClass =
  'quant-panel rounded-xl p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all hover:scale-[1.02] hover:border-brass-400/30'

type BacktestMetricsBarProps = {
  metrics: BacktestMetrics
}

export function BacktestMetricsBar({ metrics }: BacktestMetricsBarProps) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className={metricCardClass}>
        <h4 className="text-silver-400 text-xs font-semibold tracking-wider uppercase">
          Total PnL
        </h4>
        <p
          className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${metrics.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {formatSignedCurrency(metrics.total_pnl)}
        </p>
      </div>
      <div className={metricCardClass}>
        <h4 className="text-silver-400 text-xs font-semibold tracking-wider uppercase">Win Rate</h4>
        <p className="text-silver-100 mt-1.5 text-2xl font-bold tracking-tight">
          {(metrics.win_rate * 100).toFixed(1)}%
        </p>
      </div>
      <div className={metricCardClass}>
        <h4 className="text-silver-400 text-xs font-semibold tracking-wider uppercase">
          Total Trades
        </h4>
        <p className="text-silver-100 mt-1.5 text-2xl font-bold tracking-tight">
          {metrics.total_trades}
        </p>
      </div>
      <div className={metricCardClass}>
        <h4 className="text-silver-400 text-xs font-semibold tracking-wider uppercase">
          Max Drawdown
        </h4>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-rose-400">
          -{(metrics.max_drawdown_pct * 100).toFixed(2)}%
        </p>
      </div>
    </div>
  )
}
