import {
  formatTeaserMaxDrawdown,
  formatTeaserNetProfit,
  formatTeaserTradeCount,
  formatTeaserWinRate,
} from '@/lib/backtesting/backtestMetricFormatters'
import type { BacktestMetrics } from '@/types/backtesting'

type BacktestMetricTeaserProps = {
  metrics: BacktestMetrics
}

export function BacktestMetricTeaser({ metrics }: BacktestMetricTeaserProps) {
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <div className="flex items-baseline gap-1.5">
        <dt className="text-silver-500">Net profit</dt>
        <dd
          className={`font-semibold tabular-nums ${metrics.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {formatTeaserNetProfit(metrics)}
        </dd>
      </div>
      <div className="flex items-baseline gap-1.5">
        <dt className="text-silver-500">Win rate</dt>
        <dd className="text-silver-200 font-semibold tabular-nums">
          {formatTeaserWinRate(metrics)}
        </dd>
      </div>
      <div className="flex items-baseline gap-1.5">
        <dt className="text-silver-500">Max DD</dt>
        <dd className="font-semibold text-rose-400 tabular-nums">
          {formatTeaserMaxDrawdown(metrics)}
        </dd>
      </div>
      <div className="flex items-baseline gap-1.5">
        <dt className="text-silver-500">Trades</dt>
        <dd className="text-silver-200 font-semibold tabular-nums">
          {formatTeaserTradeCount(metrics)}
        </dd>
      </div>
    </dl>
  )
}
