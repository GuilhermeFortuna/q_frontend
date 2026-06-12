import { BacktestMetricTeaser } from '@/components/backtests/focus/backtestMetricTeaser'
import { EquitySparkline } from '@/components/backtests/focus/EquitySparkline'
import { cn } from '@/lib/utils'
import type { BacktestMetrics, EquityPoint } from '@/types/backtesting'

type CollapsedResultsTeaserProps = {
  isPending: boolean
  hasResults: boolean
  metrics: BacktestMetrics | undefined
  equityCurve: EquityPoint[]
  onExpand: () => void
  onOpenHistory: () => void
}

const teaserButtonClass =
  'border-carbon-600/50 bg-carbon-950/50 hover:border-brass-500/35 focus-visible:ring-brass-500/40 flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none'

export function CollapsedResultsTeaser({
  isPending,
  hasResults,
  metrics,
  equityCurve,
  onExpand,
  onOpenHistory,
}: CollapsedResultsTeaserProps) {
  if (isPending) {
    return (
      <button
        type="button"
        className={cn(teaserButtonClass, 'justify-center')}
        aria-expanded={false}
        aria-label="Expand results — simulation in progress"
        onClick={onExpand}
      >
        <span className="border-brass-500 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
        <span className="text-silver-300 text-xs font-medium">Simulating…</span>
      </button>
    )
  }

  if (hasResults && metrics) {
    return (
      <button
        type="button"
        className={teaserButtonClass}
        aria-expanded={false}
        aria-label="Expand results"
        onClick={onExpand}
      >
        <BacktestMetricTeaser metrics={metrics} />
        <EquitySparkline data={equityCurve} className="ml-auto shrink-0" />
      </button>
    )
  }

  return (
    <button
      type="button"
      className={teaserButtonClass}
      aria-expanded={false}
      aria-label="Open backtest history"
      onClick={onOpenHistory}
    >
      <span className="text-silver-400 text-xs">
        No results yet — <span className="text-brass-400 font-medium">browse history</span>
      </span>
    </button>
  )
}
