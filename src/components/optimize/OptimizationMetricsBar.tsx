import { cn } from '@/lib/utils'
import {
  computeBestMultiObjectiveMetrics,
  formatFractionAsPercent,
} from '@/lib/optimize/multiObjectiveMetrics'
import type { OptimizationResults } from '@/types/optimization'

type OptimizationMetricsBarProps = {
  results: OptimizationResults
}

function countByStatus(trials: OptimizationResults['trials'], status: string) {
  return trials.filter((t) => (t.user_attrs.status ?? t.state.toLowerCase()) === status).length
}

const metricCardClass =
  'quant-panel quant-panel--shimmer rounded-xl p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all hover:scale-[1.02] hover:border-brass-400/30'

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
          <div
            className={cn(
              metricCardClass,
              'quant-panel--glow quant-panel--glow-breathing hover:scale-[1.02]',
            )}
          >
            <Metric label="Best Return" value={formatFractionAsPercent(bestReturn)} highlight />
          </div>
          <div
            className={cn(
              metricCardClass,
              'quant-panel--glow quant-panel--glow-breathing hover:scale-[1.02]',
            )}
          >
            <Metric label="Best Drawdown" value={formatFractionAsPercent(bestDrawdown)} highlight />
          </div>
        </>
      ) : (
        <div
          className={cn(
            metricCardClass,
            'quant-panel--glow quant-panel--glow-breathing hover:scale-[1.02]',
          )}
        >
          <Metric label="Best Objective" value={bestObjective} highlight />
        </div>
      )}
      <div className={metricCardClass}>
        <Metric label="Completed" value={String(completed)} />
      </div>
      <div className={metricCardClass}>
        <Metric label="Pruned" value={String(pruned)} />
      </div>
      <div className={metricCardClass}>
        <Metric label="Failed" value={String(failed)} />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <p className="text-silver-400 text-[10px] font-bold tracking-wider uppercase">{label}</p>
      <p
        className={cn(
          'mt-1.5 font-mono text-xl font-bold tracking-tight',
          highlight ? 'text-brass-400' : 'text-silver-100',
        )}
      >
        {value}
      </p>
    </div>
  )
}
