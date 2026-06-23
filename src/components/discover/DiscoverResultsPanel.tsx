import { useState } from 'react'
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
import { LazyLiveSwarmVisualizer3D } from '@/components/discover/LazyLiveSwarmVisualizer3D'
import { Button } from '@/components/ui/button'
import { hasGeneticSummary, isGeneticSearchConfig } from '@/types/strategySearch'
import { cn } from '@/lib/utils'

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
  const [runningTab, setRunningTab] = useState<'progress' | 'swarm'>('progress')
  const [completedTab, setCompletedTab] = useState<'leaderboard' | 'swarm'>('leaderboard')
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null)

  const isGenetic = status
    ? isGeneticSearchConfig(status.search_config)
    : results
      ? isGeneticSearchConfig(results.search_config)
      : false

  if (isRunning && status) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pr-1">
        {isGenetic && (
          <div className="border-carbon-600/60 mb-2 flex shrink-0 gap-1 border-b">
            <button
              type="button"
              onClick={() => setRunningTab('progress')}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                runningTab === 'progress'
                  ? 'border-brass-400 text-brass-400 font-semibold'
                  : 'text-silver-400 hover:text-silver-200 border-transparent',
              )}
            >
              Progress & Logs
            </button>
            <button
              type="button"
              onClick={() => setRunningTab('swarm')}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                runningTab === 'swarm'
                  ? 'border-brass-400 text-brass-400 font-semibold'
                  : 'text-silver-400 hover:text-silver-200 border-transparent',
              )}
            >
              3D Live Swarm
            </button>
          </div>
        )}

        {runningTab === 'progress' || !isGenetic ? (
          <>
            <div className="flex shrink-0 justify-center">
              <DiscoverProgress status={status} onCancel={onCancel} cancelling={cancelling} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <h4 className="text-silver-300 mb-2 shrink-0 text-xs font-bold tracking-wider uppercase">
                Live Trial Progress & Logs
              </h4>
              <DiscoverLogs logs={status.logs} />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <LazyLiveSwarmVisualizer3D status={status} results={undefined} isRunning={true} />
            <div className="border-carbon-800 bg-carbon-950/40 flex items-center justify-between rounded-xl border p-4 shadow-sm">
              <div className="flex flex-col">
                <span className="text-silver-100 text-xs font-semibold">
                  Generation {status.generation ?? 0} / {status.total_generations ?? 0}
                </span>
                <span className="text-silver-500 mt-0.5 font-mono text-[10px]">
                  Evaluated: {Math.floor(status.current_candidate)} / {status.total_candidates}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="text-silver-400 text-xs font-bold tracking-wider uppercase hover:text-red-400"
                onClick={onCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Search'}
              </Button>
            </div>
          </div>
        )}
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

        {isGenetic && (
          <div className="border-carbon-600/60 mb-2 flex shrink-0 gap-1 border-b">
            <button
              type="button"
              onClick={() => setCompletedTab('leaderboard')}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                completedTab === 'leaderboard'
                  ? 'border-brass-400 text-brass-400 font-semibold'
                  : 'text-silver-400 hover:text-silver-200 border-transparent',
              )}
            >
              Leaderboard Table
            </button>
            <button
              type="button"
              onClick={() => setCompletedTab('swarm')}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                completedTab === 'swarm'
                  ? 'border-brass-400 text-brass-400 font-semibold'
                  : 'text-silver-400 hover:text-silver-200 border-transparent',
              )}
            >
              Swarm Analysis (3D)
            </button>
          </div>
        )}

        {completedTab === 'leaderboard' || !isGenetic ? (
          <LeaderboardTable
            runId={runId}
            candidates={results.candidates}
            objectiveMode={objectiveMode}
            backtest={backtest}
            searchConfig={results.search_config}
          />
        ) : (
          <LazyLiveSwarmVisualizer3D
            status={status}
            results={results}
            isRunning={false}
            selectedTrialId={selectedTrialId}
            onSelectTrialId={setSelectedTrialId}
          />
        )}
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
