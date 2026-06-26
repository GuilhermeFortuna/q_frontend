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
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { StatTile } from '@/components/ui/StatTile'
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
        {isGenetic ? (
          <SegmentedToggle
            aria-label="Running view"
            className="mb-2 shrink-0"
            value={runningTab}
            onChange={setRunningTab}
            options={[
              { value: 'progress', label: 'Progress & Logs' },
              { value: 'swarm', label: '3D Live Swarm' },
            ]}
          />
        ) : null}

        {runningTab === 'progress' || !isGenetic ? (
          <>
            <div className="flex shrink-0 justify-center">
              <DiscoverProgress status={status} onCancel={onCancel} cancelling={cancelling} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SectionHeader title="Live Trial Progress & Logs" className="mb-2 shrink-0" />
              <DiscoverLogs logs={status.logs} />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <LazyLiveSwarmVisualizer3D status={status} results={undefined} isRunning={true} />
            <Panel className="flex items-center justify-between p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                <StatTile
                  className="p-3"
                  label="Generation"
                  value={`${status.generation ?? 0} / ${status.total_generations ?? 0}`}
                />
                <StatTile
                  className="p-3"
                  label="Evaluated"
                  value={`${Math.floor(status.current_candidate)} / ${status.total_candidates}`}
                />
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
            </Panel>
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
          <Panel className="border-brass-500/30 bg-brass-500/5 shrink-0 p-4">
            <SectionHeader title="Best strategy (ranked on out-of-sample)" />
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-brass-400 text-2xl font-bold">{best.strategy}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <StatTile
                    className="p-3"
                    label={`OOS ${objectiveMetricLabel(objectiveMode)}`}
                    value={formatObjectiveMetricValue(best.objective_value, objectiveMode)}
                    highlight
                  />
                  <StatTile
                    className="p-3"
                    label="Efficiency"
                    value={formatEfficiencyRatio(best.efficiency)}
                  />
                </div>
              </div>
              <p className="text-silver-300 max-w-lg text-sm">
                {bestStrategyGloss(best.efficiency)}
              </p>
            </div>
          </Panel>
        ) : null}

        {isGenetic ? (
          <SegmentedToggle
            aria-label="Results view"
            className="mb-2 shrink-0"
            value={completedTab}
            onChange={setCompletedTab}
            options={[
              { value: 'leaderboard', label: 'Leaderboard Table' },
              { value: 'swarm', label: 'Swarm Analysis (3D)' },
            ]}
          />
        ) : null}

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
    <Panel className="flex min-h-0 flex-1 items-center justify-center border-2 border-dashed bg-transparent">
      <div className="text-center">
        <SectionHeader title="No Strategy Search Yet" className="justify-center" />
        <p className="text-silver-400 mt-2 max-w-sm text-sm">
          Configure instrument, walk-forward windows, and strategies, then launch a search to see
          the OOS-ranked leaderboard.
        </p>
        <Button type="button" variant="brass" className="mt-4" onClick={onOpenWorkbench}>
          Open Workbench
        </Button>
      </div>
    </Panel>
  )
}
