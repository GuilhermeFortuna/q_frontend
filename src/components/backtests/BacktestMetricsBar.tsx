import { Card } from '@/components/ui/card'
import type { BacktestMetrics } from '@/types/backtesting'

type BacktestMetricsBarProps = {
  metrics: BacktestMetrics
}

export function BacktestMetricsBar({ metrics }: BacktestMetricsBarProps) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card className="quant-panel border-carbon-600/60 p-4">
        <h4 className="text-silver-400 text-sm font-medium">Total PnL</h4>
        <p
          className={`mt-1 text-2xl font-bold ${metrics.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {metrics.total_pnl >= 0 ? '+' : ''}
          {metrics.total_pnl.toFixed(2)}
        </p>
      </Card>
      <Card className="quant-panel border-carbon-600/60 p-4">
        <h4 className="text-silver-400 text-sm font-medium">Win Rate</h4>
        <p className="text-silver-100 mt-1 text-2xl font-bold">
          {(metrics.win_rate * 100).toFixed(1)}%
        </p>
      </Card>
      <Card className="quant-panel border-carbon-600/60 p-4">
        <h4 className="text-silver-400 text-sm font-medium">Total Trades</h4>
        <p className="text-silver-100 mt-1 text-2xl font-bold">{metrics.total_trades}</p>
      </Card>
      <Card className="quant-panel border-carbon-600/60 p-4">
        <h4 className="text-silver-400 text-sm font-medium">Max Drawdown</h4>
        <p className="mt-1 text-2xl font-bold text-rose-400">
          -{(metrics.max_drawdown_pct * 100).toFixed(2)}%
        </p>
      </Card>
    </div>
  )
}
