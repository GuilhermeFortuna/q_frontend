import { cn } from '@/lib/utils'
import {
  computeBestMultiObjectiveMetrics,
  formatFractionAsPercent,
} from '@/lib/optimize/multiObjectiveMetrics'
import { StatTile } from '@/components/ui/StatTile'
import type { OptimizationResults } from '@/types/optimization'

type OptimizationMetricsBarProps = {
  results: OptimizationResults
}

function countByStatus(trials: OptimizationResults['trials'], status: string) {
  return trials.filter((t) => (t.user_attrs.status ?? t.state.toLowerCase()) === status).length
}

export function OptimizationMetricsBar({ results }: OptimizationMetricsBarProps) {
  const completed = countByStatus(results.trials, 'complete')
  const pruned = results.trials.filter(
    (t) => t.state === 'PRUNED' || t.user_attrs.status === 'pruned',
  ).length
  const failed = results.failures.length

  const bestObjective =
    results.best_trial?.values && results.best_trial.values.length > 0
      ? results.best_trial.values.map((v) => v.toFixed(4)).join(', ')
      : '—'

  const { bestReturn, bestDrawdown } = results.is_multi_objective
    ? computeBestMultiObjectiveMetrics(results.trials)
    : { bestReturn: null, bestDrawdown: null }

  return (
    <div
      className={cn(
        'mb-4 grid grid-cols-2 gap-4',
        results.is_multi_objective ? 'sm:grid-cols-5' : 'sm:grid-cols-4',
      )}
    >
      {results.is_multi_objective ? (
        <>
          <StatTile
            label="Best Return"
            value={formatFractionAsPercent(bestReturn)}
            highlight
            className="quant-panel--glow-hero"
          />
          <StatTile
            label="Best Drawdown"
            value={formatFractionAsPercent(bestDrawdown)}
            highlight
            className="quant-panel--glow-hero"
          />
        </>
      ) : (
        <StatTile
          label="Best Objective"
          value={bestObjective}
          highlight
          className="quant-panel--glow-hero"
        />
      )}
      <StatTile label="Completed" value={String(completed)} />
      <StatTile label="Pruned" value={String(pruned)} />
      <StatTile label="Failed" value={String(failed)} />
    </div>
  )
}
