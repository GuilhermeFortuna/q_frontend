import { BacktestMetricsBar } from '@/components/backtests/BacktestMetricsBar'
import { EquityCurveChart } from '@/components/backtests/EquityCurveChart'
import { formatEfficiencyRatio } from '@/lib/walkforward/objectiveMetric'
import { walkForwardEquityToChartPoints } from '@/lib/walkforward/equityPoints'
import { coerceBacktestMetrics } from '@/lib/walkforward/coerceMetrics'
import type { OptimizationBacktestConfig } from '@/types/optimization'
import type { WalkForwardResults } from '@/types/walkforward'

import { IsOosComparisonChart } from '@/components/walkforward/IsOosComparisonChart'
import { WalkForwardWindowsTable } from '@/components/walkforward/WalkForwardWindowsTable'

type WalkForwardResultsViewProps = {
  results: WalkForwardResults
  backtest: OptimizationBacktestConfig
  statusLabel?: string
}

export function WalkForwardResultsView({
  results,
  backtest,
  statusLabel,
}: WalkForwardResultsViewProps) {
  const objectiveMode = results.optimization_config?.objective.mode ?? 'maximize_return_drawdown'
  const equityPoints = walkForwardEquityToChartPoints(results.equity_curve)
  const windowBoundaries = results.windows
    .filter((window) => window.status === 'completed')
    .map((window) => window.test_start)
  const efficiency = results.efficiency
  const efficiencyTone =
    efficiency == null
      ? 'text-silver-300'
      : efficiency >= 0.6
        ? 'text-emerald-400'
        : efficiency >= 0.5
          ? 'text-brass-400'
          : efficiency <= 0
            ? 'text-rose-400'
            : 'text-amber-300'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {statusLabel ? (
        <p className="text-silver-400 shrink-0 text-sm italic">{statusLabel}</p>
      ) : null}

      <div className="border-brass-500/30 bg-brass-500/5 shrink-0 rounded-xl border p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-silver-400 text-xs font-semibold tracking-wider uppercase">
              Walk-forward efficiency
            </p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${efficiencyTone}`}>
              {formatEfficiencyRatio(efficiency)}
            </p>
          </div>
          <p className="text-silver-300 max-w-md text-sm">
            {efficiency == null
              ? 'Efficiency unavailable — not enough completed windows to compare IS vs OOS objectives.'
              : efficiency >= 0.6
                ? 'OOS performance holds up well versus in-sample optimization — parameters likely generalize.'
                : efficiency >= 0.5
                  ? 'Moderate transfer to unseen data — review per-window breakdown before trusting live params.'
                  : efficiency <= 0
                    ? 'OOS objective collapsed versus IS — strong overfit signal.'
                    : 'Weak OOS transfer — treat optimized parameters as suspect until validated further.'}
          </p>
        </div>
      </div>

      <BacktestMetricsBar metrics={coerceBacktestMetrics(results.oos_metrics)} />

      <EquityCurveChart
        data={equityPoints}
        initialCapital={backtest.initial_capital}
        windowBoundaries={windowBoundaries}
        fillHeight
      />

      <IsOosComparisonChart windows={results.windows} objectiveMode={objectiveMode} />

      <div>
        <h4 className="text-silver-200 mb-2 text-sm font-medium">Per-window breakdown</h4>
        <WalkForwardWindowsTable windows={results.windows} objectiveMode={objectiveMode} />
      </div>
    </div>
  )
}
