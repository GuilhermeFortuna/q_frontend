import { BacktestMetricsBar } from '@/components/backtests/BacktestMetricsBar'
import { EquityCurveChart } from '@/components/backtests/EquityCurveChart'
import { formatEfficiencyRatio } from '@/lib/walkforward/objectiveMetric'
import { walkForwardEquityToChartPoints } from '@/lib/walkforward/equityPoints'
import { coerceBacktestMetrics } from '@/lib/walkforward/coerceMetrics'
import type { OptimizationBacktestConfig } from '@/types/optimization'
import type { WalkForwardResults } from '@/types/walkforward'

import { IsOosComparisonChart } from '@/components/walkforward/IsOosComparisonChart'
import { WalkForwardWindowsTable } from '@/components/walkforward/WalkForwardWindowsTable'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatTile } from '@/components/ui/StatTile'
import type { StatTileDeltaTone } from '@/components/ui/StatTile'

type WalkForwardResultsViewProps = {
  results: WalkForwardResults
  backtest: OptimizationBacktestConfig
  statusLabel?: string
  /** Hide per-window table and use a single aggregated IS/OOS bar pair. */
  compact?: boolean
  aggregatedIsMetrics?: Record<string, number> | null
}

function efficiencyValueTone(efficiency: number | null | undefined): StatTileDeltaTone {
  if (efficiency == null) return 'neutral'
  if (efficiency >= 0.6) return 'up'
  if (efficiency <= 0) return 'down'
  return 'neutral'
}

function efficiencyGloss(efficiency: number | null | undefined): string {
  if (efficiency == null) {
    return 'Efficiency unavailable — not enough completed windows to compare IS vs OOS objectives.'
  }
  if (efficiency >= 0.6) {
    return 'OOS performance holds up well versus in-sample optimization — parameters likely generalize.'
  }
  if (efficiency >= 0.5) {
    return 'Moderate transfer to unseen data — review per-window breakdown before trusting live params.'
  }
  if (efficiency <= 0) {
    return 'OOS objective collapsed versus IS — strong overfit signal.'
  }
  return 'Weak OOS transfer — treat optimized parameters as suspect until validated further.'
}

export function WalkForwardResultsView({
  results,
  backtest,
  statusLabel,
  compact = false,
  aggregatedIsMetrics = null,
}: WalkForwardResultsViewProps) {
  const objectiveMode = results.optimization_config?.objective.mode ?? 'maximize_return_drawdown'
  const equityPoints = walkForwardEquityToChartPoints(results.equity_curve)
  const windowBoundaries = results.windows
    .filter((window) => window.status === 'completed')
    .map((window) => window.test_start)
  const efficiency = results.efficiency

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {statusLabel ? (
        <p className="text-silver-400 shrink-0 text-sm italic">{statusLabel}</p>
      ) : null}

      <Panel className="border-brass-500/30 bg-brass-500/5 shrink-0 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <StatTile
            className="min-w-[12rem] p-3"
            label="Walk-forward efficiency"
            value={formatEfficiencyRatio(efficiency)}
            valueTone={efficiencyValueTone(efficiency)}
            highlight={efficiency != null && efficiency >= 0.6}
          />
          <p className="text-silver-300 max-w-md text-sm">{efficiencyGloss(efficiency)}</p>
        </div>
      </Panel>

      <BacktestMetricsBar metrics={coerceBacktestMetrics(results.oos_metrics)} />

      <EquityCurveChart
        data={equityPoints}
        initialCapital={backtest.initial_capital}
        windowBoundaries={windowBoundaries}
      />

      <IsOosComparisonChart
        windows={compact ? [] : results.windows}
        objectiveMode={objectiveMode}
        aggregatedSummary={
          compact
            ? { is_metrics: aggregatedIsMetrics, oos_metrics: results.oos_metrics }
            : undefined
        }
      />

      {!compact ? (
        <div>
          <SectionHeader title="Per-window breakdown" className="mb-2" />
          <WalkForwardWindowsTable windows={results.windows} objectiveMode={objectiveMode} />
        </div>
      ) : null}
    </div>
  )
}
