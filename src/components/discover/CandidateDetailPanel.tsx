import { Loader2 } from 'lucide-react'

import { useStrategySearchCandidateEquity } from '@/api/queries/strategySearch'
import { WalkForwardResultsView } from '@/components/walkforward/WalkForwardResultsView'
import { isSummaryToMetrics } from '@/lib/discover/candidateMetrics'
import type { ObjectiveMode, OptimizationBacktestConfig } from '@/types/optimization'
import type { CandidateResult } from '@/types/strategySearch'
import type { WalkForwardResults } from '@/types/walkforward'

type CandidateDetailPanelProps = {
  runId: string
  candidate: CandidateResult
  backtest: OptimizationBacktestConfig
  objectiveMode: ObjectiveMode
}

export function CandidateDetailPanel({
  runId,
  candidate,
  backtest,
  objectiveMode,
}: CandidateDetailPanelProps) {
  const canShowChart = candidate.status === 'completed' && candidate.oos_metrics != null
  const equityQuery = useStrategySearchCandidateEquity(runId, candidate.candidate_id, canShowChart)

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
      backtest: { ...backtest, strategy: candidate.strategy },
      search_space: { strategy_params: {}, risk_params: {} },
    },
  }

  return (
    <WalkForwardResultsView
      results={syntheticResults}
      backtest={{ ...backtest, strategy: candidate.strategy }}
      compact
      aggregatedIsMetrics={aggregatedIsMetrics}
    />
  )
}
