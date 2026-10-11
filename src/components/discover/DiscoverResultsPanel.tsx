import { useState } from 'react'
import { DiscoverProgress } from '@/components/discover/DiscoverProgress'
import { DiscoverLogs } from '@/components/discover/DiscoverLogs'
import { DiscoverTrialsTable } from '@/components/discover/DiscoverTrialsTable'
import { LeaderboardTable } from '@/components/discover/LeaderboardTable'
import { LazyLiveSwarmVisualizer3D } from '@/components/discover/LazyLiveSwarmVisualizer3D'
import { GeneticVerdictPanel } from '@/components/discover/GeneticVerdictPanel'
import { Button, Panel, Callout } from '@/components/ui'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { formatObjectiveMetricValue } from '@/lib/walkforward/objectiveMetric'
import { isGeneticSearchConfig, hasGeneticSummary } from '@/types/strategySearch'
import type { StrategySearchResults, StrategySearchStatus } from '@/types/strategySearch'
import type { OptimizationBacktestConfig } from '@/types/optimization'

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
  const [tab, setTab] = useState<'candidates' | 'trials' | 'logs' | 'swarm'>('candidates')
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null)
  const config = results?.search_config ?? status?.search_config
  const genetic = isGeneticSearchConfig(config)
  if (!runId)
    return (
      <Panel className="flex min-h-0 flex-1 items-center justify-center border-2 border-dashed bg-transparent">
        <div className="text-center">
          <h3 className="text-silver-200 text-xl">No Strategy Search Yet</h3>
          <p className="text-silver-400 mt-2 text-sm">
            Configure instrument, walk-forward windows, and strategies to launch a search.
          </p>
          <Button variant="brass" className="mt-4" onClick={onOpenWorkbench}>
            Open Workbench
          </Button>
        </div>
      </Panel>
    )
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {isRunning && status ? (
        <DiscoverProgress status={status} onCancel={onCancel} cancelling={cancelling} />
      ) : null}
      {status?.status === 'failed' ? (
        <Callout type="error" title="Search Failed">
          {status.error ?? 'Unknown error'} · Available partial results are shown below.
        </Callout>
      ) : null}
      {status?.status === 'cancelled' ? (
        <p className="text-silver-400 text-xs">Search cancelled — showing partial results.</p>
      ) : null}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <SegmentedToggle
          aria-label="Discovery results view"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'candidates', label: 'Candidates' },
            { value: 'trials', label: 'Trials' },
            { value: 'logs', label: 'Logs' },
            ...(genetic ? [{ value: 'swarm' as const, label: 'Swarm (3D)' }] : []),
          ]}
        />
        <span className="text-silver-400 text-xs">
          {isRunning
            ? 'Live · ranks are provisional'
            : results?.provisional
              ? 'Partial results · ranks are provisional'
              : 'Search results'}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={tab === 'candidates' ? 'min-h-0 flex-1 space-y-3 overflow-auto' : 'hidden'}>
          {!isRunning &&
          results &&
          !results.provisional &&
          (hasGeneticSummary(results.summary) || genetic) ? (
            <GeneticVerdictPanel summary={results.summary} best={results.best} />
          ) : null}
          {results?.best ? (
            <Panel className="border-brass-500/30 bg-brass-500/5 p-3 text-sm">
              <span className="text-silver-400">
                {isRunning || results.provisional
                  ? 'Best so far (OOS)'
                  : 'Best strategy (ranked on out-of-sample)'}{' '}
                ·{' '}
              </span>
              <strong className="text-brass-400">{results.best.strategy}</strong> ·{' '}
              {formatObjectiveMetricValue(results.best.objective_value, results.objective_mode)}
            </Panel>
          ) : null}
          {results && backtest ? (
            <LeaderboardTable
              artifactsAvailable={
                results.artifacts_available ?? (!isRunning && !results.provisional)
              }
              runId={runId}
              candidates={results.candidates}
              objectiveMode={results.objective_mode}
              backtest={backtest}
              searchConfig={config}
            />
          ) : null}
          {!results?.candidates.length ? (
            <Panel className="text-silver-400 p-6 text-sm">
              {isRunning
                ? 'Waiting for the first candidate to finish its walk-forward evaluation. Individual trials appear in Trials as they finish.'
                : 'No candidate results are available.'}
            </Panel>
          ) : null}
        </div>
        <div className={tab === 'trials' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          <DiscoverTrialsTable runId={runId} running={isRunning} />
        </div>
        {tab === 'logs' ? <DiscoverLogs logs={status?.logs} /> : null}
        {tab === 'swarm' ? (
          <LazyLiveSwarmVisualizer3D
            status={status}
            results={results}
            isRunning={isRunning}
            selectedTrialId={selectedTrialId}
            onSelectTrialId={setSelectedTrialId}
          />
        ) : null}
      </div>
    </div>
  )
}
