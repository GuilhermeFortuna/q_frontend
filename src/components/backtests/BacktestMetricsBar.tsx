import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import { StatTile } from '@/components/ui/StatTile'
import type { BacktestMetrics } from '@/types/backtesting'

type BacktestMetricsBarProps = {
  metrics: BacktestMetrics
}

export function BacktestMetricsBar({ metrics }: BacktestMetricsBarProps) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatTile
        label="Total PnL"
        value={formatSignedCurrency(metrics.total_pnl)}
        valueTone={metrics.total_pnl >= 0 ? 'up' : 'down'}
      />
      <StatTile label="Win Rate" value={`${(metrics.win_rate * 100).toFixed(1)}%`} />
      <StatTile label="Total Trades" value={String(metrics.total_trades)} />
      <StatTile
        label="Max Drawdown"
        value={`-${(metrics.max_drawdown_pct * 100).toFixed(2)}%`}
        valueTone="down"
      />
    </div>
  )
}
