import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import {
  useStrategySearchCandidateEquity,
  useStrategySearchCandidateGenome,
} from '@/api/queries/strategySearch'
import { GenomeViewer, ComplexityLine } from '@/components/discover/GenomeViewer'
import { ExitInsightPanel } from '@/components/discover/ExitInsightPanel'
import { WalkForwardResultsView } from '@/components/walkforward/WalkForwardResultsView'
import { isSummaryToMetrics } from '@/lib/discover/candidateMetrics'
import { cn } from '@/lib/utils'
import type { ObjectiveMode, OptimizationBacktestConfig } from '@/types/optimization'
import type { CandidateResult, StrategySearchConfig } from '@/types/strategySearch'
import { isGeneticCandidate, isGeneticSearchConfig } from '@/types/strategySearch'
import type { WalkForwardResults } from '@/types/walkforward'

type CandidateDetailPanelProps = {
  runId: string
  candidate: CandidateResult
  backtest: OptimizationBacktestConfig
  objectiveMode: ObjectiveMode
  searchConfig?: StrategySearchConfig
}

export function CandidateDetailPanel({
  runId,
  candidate,
  backtest,
  objectiveMode,
  searchConfig,
}: CandidateDetailPanelProps) {
  const [detailTab, setDetailTab] = useState<'performance' | 'genome'>('performance')
  const showGenomeTab = isGeneticSearchConfig(searchConfig) && isGeneticCandidate(candidate)
  const canShowChart = candidate.status === 'completed' && candidate.oos_metrics != null
  const equityQuery = useStrategySearchCandidateEquity(runId, candidate.candidate_id, canShowChart)

  const genomeQuery = useStrategySearchCandidateGenome(
    runId,
    candidate.candidate_id,
    showGenomeTab && detailTab === 'genome' && candidate.genome == null,
  )

  const genome = candidate.genome ?? genomeQuery.data?.genome ?? null

  if (candidate.status === 'no_result' || candidate.status === 'error') {
    return (
      <div className="border-carbon-600/40 bg-carbon-950/30 rounded-lg border p-4 text-sm text-amber-200">
        {candidate.error ?? 'No walk-forward result for this candidate.'}
      </div>
    )
  }

  if (candidate.status === 'unsupported') {
    return (
      <div className="border-carbon-600/40 bg-carbon-950/30 text-silver-400 rounded-lg border p-4 text-sm">
        {candidate.error ?? 'This strategy is not supported for candle walk-forward search.'}
      </div>
    )
  }

  const performanceView = (() => {
    if (equityQuery.isLoading) {
      return (
        <div className="text-silver-400 flex items-center gap-2 py-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading OOS equity curve…
        </div>
      )
    }

    const equityCurve = equityQuery.data?.points ?? []
    const aggregatedIsMetrics = isSummaryToMetrics(candidate.is_metrics_summary, objectiveMode)
    const strategyName = isGeneticCandidate(candidate) ? 'CompositeStrategy' : candidate.strategy

    const syntheticResults: WalkForwardResults = {
      run_id: runId,
      status: 'completed',
      windows: [],
      oos_metrics: candidate.oos_metrics ?? {},
      efficiency: candidate.efficiency,
      equity_curve: equityCurve,
      optimization_config: {
        study: { name: candidate.strategy, n_trials: 0 },
        objective: { mode: objectiveMode },
        backtest: { ...backtest, strategy: strategyName },
        search_space: { strategy_params: {}, risk_params: {} },
      },
    }

    return (
      <>
        <WalkForwardResultsView
          results={syntheticResults}
          backtest={{ ...backtest, strategy: strategyName }}
          compact
          aggregatedIsMetrics={aggregatedIsMetrics}
        />
        <ExitInsightPanel candidate={candidate} />
      </>
    )
  })()

  const genomeView = (() => {
    if (genomeQuery.isLoading) {
      return (
        <div className="text-silver-400 flex items-center gap-2 py-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading genome…
        </div>
      )
    }

    if (genome) {
      return <GenomeViewer genome={genome} />
    }

    return (
      <p className="text-silver-500 py-4 text-sm">
        {genomeQuery.isError
          ? 'Genome unavailable for this candidate.'
          : 'No genome data for this candidate.'}
      </p>
    )
  })()

  if (!showGenomeTab) {
    return performanceView
  }

  return (
    <div className="space-y-3">
      <ComplexityLine genomeNodeCount={candidate.genome_node_count} genome={genome} />
      {candidate.dsr != null ? (
        <p className="text-silver-400 text-xs">
          Candidate DSR:{' '}
          <span className="text-silver-200 font-mono">{(candidate.dsr * 100).toFixed(0)}%</span>
        </p>
      ) : null}
      <div className="flex gap-1">
        {(
          [
            ['performance', 'Performance'],
            ['genome', 'Genome'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={detailTab === tab}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors',
              detailTab === tab
                ? 'bg-brass-500/20 text-brass-300'
                : 'text-silver-400 hover:text-silver-200',
            )}
            onClick={() => setDetailTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>
      {detailTab === 'performance' ? performanceView : genomeView}
    </div>
  )
}
