import { bestStrategyGloss } from '@/lib/discover/candidateMetrics'
import {
  formatEfficiencyRatio,
  formatObjectiveMetricValue,
  objectiveMetricLabel,
} from '@/lib/walkforward/objectiveMetric'
import type { OptimizationBacktestConfig } from '@/types/optimization'
import type { StrategySearchResults, StrategySearchStatus } from '@/types/strategySearch'

import { GeneticVerdictPanel } from '@/components/discover/GeneticVerdictPanel'
import { DiscoverProgress } from '@/components/discover/DiscoverProgress'
import { DiscoverLogs } from '@/components/discover/DiscoverLogs'
import { LeaderboardTable } from '@/components/discover/LeaderboardTable'
import { Button } from '@/components/ui/button'
import { hasGeneticSummary, isGeneticSearchConfig } from '@/types/strategySearch'

type DiscoverResultsPanelProps = {
  runId: string | null
  isRunning: boolean
  status: StrategySearchStatus | undefined
  results: StrategySearchResults | undefined
  backtest: OptimizationBacktestConfig | null
  onCancel: () => void
  cancelling: boolean
  onOpenWorkbench: () => void
}

export function DiscoverResultsPanel({
  runId,
  isRunning,
  status,
  results,
  backtest,
  onCancel,
  cancelling,
  onOpenWorkbench,
}: DiscoverResultsPanelProps) {
  if (isRunning && status) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pr-1">
        <div className="flex shrink-0 justify-center">
          <DiscoverProgress status={status} onCancel={onCancel} cancelling={cancelling} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <h4 className="text-silver-300 mb-2 shrink-0 text-xs font-bold tracking-wider uppercase">
            Live Trial Progress & Logs
          </h4>
          <DiscoverLogs logs={status.logs} />
        </div>
      </div>
    )
  }

  if (status?.status === 'failed') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="max-w-md rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-sm break-words text-rose-400">
          Strategy search failed: {status.error ?? 'unknown error'}
        </div>
      </div>
    )
  }

  if (results && backtest && runId) {
    const best = results.best
    const objectiveMode = results.objective_mode
    const statusLabel =
      status?.status === 'cancelled' ? 'Search cancelled — showing partial leaderboard' : undefined
    const showGeneticVerdict =
      hasGeneticSummary(results.summary) || isGeneticSearchConfig(results.search_config)

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {statusLabel ? (
          <p className="text-silver-400 shrink-0 text-sm italic">{statusLabel}</p>
        ) : null}

        {showGeneticVerdict ? <GeneticVerdictPanel summary={results.summary} best={best} /> : null}

        {best && best.status === 'completed' ? (
          <div className="border-brass-500/30 bg-brass-500/5 shrink-0 rounded-xl border p-4">
            <p className="text-silver-400 text-xs font-semibold tracking-wider uppercase">
              Best strategy (ranked on out-of-sample)
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-brass-400 text-2xl font-bold">{best.strategy}</p>
                <p className="text-silver-300 mt-1 text-sm">
                  OOS {objectiveMetricLabel(objectiveMode)}:{' '}
                  <span className="text-silver-100 font-mono tabular-nums">
                    {formatObjectiveMetricValue(best.objective_value, objectiveMode)}
                  </span>
                  {' · '}
                  Efficiency:{' '}
                  <span className="text-silver-100 font-mono tabular-nums">
                    {formatEfficiencyRatio(best.efficiency)}
                  </span>
                </p>
              </div>
              <p className="text-silver-300 max-w-lg text-sm">
                {bestStrategyGloss(best.efficiency)}
              </p>
            </div>
          </div>
        ) : null}

        <LeaderboardTable
          runId={runId}
          candidates={results.candidates}
          objectiveMode={objectiveMode}
          backtest={backtest}
          searchConfig={results.search_config}
        />
      </div>
    )
  }

  return (
    <div className="border-carbon-600/60 flex min-h-0 flex-1 items-center justify-center rounded-xl border-2 border-dashed bg-transparent">
      <div className="text-center">
        <h3 className="text-silver-200 text-xl font-medium">No Strategy Search Yet</h3>
        <p className="text-silver-400 mt-2 max-w-sm text-sm">
          Configure instrument, walk-forward windows, and strategies, then launch a search to see
          the OOS-ranked leaderboard.
        </p>
        <Button type="button" variant="brass" className="mt-4" onClick={onOpenWorkbench}>
          Open Workbench
        </Button>
      </div>
    </div>
  )
}
