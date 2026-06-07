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

  return (
    <div className="border-carbon-600/40 bg-carbon-900/40 grid grid-cols-2 gap-3 rounded-lg border p-4 sm:grid-cols-4">
      <Metric label="Best Objective" value={bestObjective} highlight />
      <Metric label="Completed" value={String(completed)} />
      <Metric label="Pruned" value={String(pruned)} />
      <Metric label="Failed" value={String(failed)} />
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
      <p className="text-silver-400 text-xs">{label}</p>
      <p className={highlight ? 'text-brass-400 text-sm font-medium' : 'text-silver-100 text-sm'}>
        {value}
      </p>
    </div>
  )
}
