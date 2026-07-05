import { formatMultiObjectiveTeaserValues } from '@/lib/optimize/multiObjectiveMetrics'
import { cn } from '@/lib/utils'
import type { OptimizationResults, OptimizationStatus } from '@/types/optimization'

type CollapsedOptimizeResultsTeaserProps = {
  isRunning: boolean
  hasResults: boolean
  status: OptimizationStatus | undefined
  results: OptimizationResults | undefined
  onExpand: () => void
  onOpenHistory: () => void
}

const teaserButtonClass =
  'border-carbon-600/50 bg-carbon-950/50 hover:border-brass-500/35 focus-visible:ring-brass-500/40 flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none'

function formatBestObjective(results: OptimizationResults | undefined): string {
  if (!results?.best_trial?.values?.length) return '—'
  if (results.is_multi_objective) {
    return formatMultiObjectiveTeaserValues(results.best_trial.values)
  }
  return results.best_trial.values.map((value) => value.toFixed(4)).join(', ')
}

export function CollapsedOptimizeResultsTeaser({
  isRunning,
  hasResults,
  status,
  results,
  onExpand,
  onOpenHistory,
}: CollapsedOptimizeResultsTeaserProps) {
  if (isRunning) {
    const completed = status?.completed_trials ?? 0
    const total = status?.n_trials ?? 0
    const progressLabel = total > 0 ? `${completed}/${total} trials` : 'Starting…'

    return (
      <button
        type="button"
        className={cn(teaserButtonClass, 'justify-center')}
        aria-expanded={false}
        aria-label="Expand results — optimization in progress"
        onClick={onExpand}
      >
        <span className="border-brass-500 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
        <span className="text-silver-300 text-xs font-medium">Optimizing… {progressLabel}</span>
      </button>
    )
  }

  if (hasResults && results) {
    const completed = results.trials.filter(
      (trial) => (trial.user_attrs.status ?? trial.state.toLowerCase()) === 'complete',
    ).length

    return (
      <button
        type="button"
        className={teaserButtonClass}
        aria-expanded={false}
        aria-label="Expand results"
        onClick={onExpand}
      >
        <span className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
          Best objective
        </span>
        <span className="text-silver-100 quant-tabular-nums text-sm font-semibold">
          {formatBestObjective(results)}
        </span>
        <span className="text-silver-500 ml-2 text-xs">·</span>
        <span className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
          Completed
        </span>
        <span className="text-silver-200 quant-tabular-nums text-sm font-medium">{completed}</span>
        <span className="text-silver-500 ml-2 text-xs">·</span>
        <span className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
          Failed
        </span>
        <span className="text-silver-200 text-sm font-medium">{results.failures.length}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={teaserButtonClass}
      aria-expanded={false}
      aria-label="Open optimization history"
      onClick={onOpenHistory}
    >
      <span className="text-silver-400 text-xs">
        No results yet — <span className="text-brass-400 font-medium">browse history</span>
      </span>
    </button>
  )
}
