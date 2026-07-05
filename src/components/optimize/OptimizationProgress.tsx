import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ActiveOutline } from '@/components/ui/ActiveOutline'
import { BestParamsCard } from '@/components/optimize/BestParamsCard'
import { TrialsTable } from '@/components/optimize/TrialsTable'
import {
  computeBestMultiObjectiveMetrics,
  formatFractionAsPercent,
  isMultiObjectiveObjectiveMode,
} from '@/lib/optimize/multiObjectiveMetrics'
import type { OptimizationResults, OptimizationStatus } from '@/types/optimization'

type OptimizationProgressProps = {
  status: OptimizationStatus
  onCancel: () => void
  cancelling: boolean
  cancelError?: string | null
}

export function OptimizationProgress({
  status,
  onCancel,
  cancelling,
  cancelError,
}: OptimizationProgressProps) {
  const pct =
    status.n_trials > 0
      ? Math.min(100, Math.round((status.completed_trials / status.n_trials) * 100))
      : 0
  const isParallel = (status.workers ?? 1) > 1
  const headerLabel = isParallel
    ? `Running ${status.n_trials} trials · ${status.workers} in parallel`
    : null

  const objectiveMode = status.optimization_config?.objective.mode ?? 'maximize_net_profit'
  const isMultiObjective = isMultiObjectiveObjectiveMode(objectiveMode)

  const mockResults = useMemo<OptimizationResults>(
    () => ({
      study_id: status.study_id,
      objective_mode: objectiveMode,
      is_multi_objective: isMultiObjective,
      best_params: status.best_params,
      best_trial: status.best_trial ?? null,
      trials: status.trials ?? [],
      pareto_trials: [],
      failures: [],
    }),
    [status, objectiveMode, isMultiObjective],
  )

  const { bestReturn, bestDrawdown } = isMultiObjective
    ? computeBestMultiObjectiveMetrics(status.trials ?? [])
    : { bestReturn: null, bestDrawdown: null }

  const showBestParams = Boolean(status.best_trial && status.backtest_config)

  return (
    <div className="animate-fade-in-up flex h-full min-h-0 w-full flex-1 flex-col gap-6 overflow-hidden p-1 lg:flex-row">
      {/* Left Column: Progress Card & Best Params Card */}
      <div className="flex w-full min-w-0 shrink-0 flex-col gap-4 lg:w-[380px]">
        {/* Progress Card */}
        <div className="surface-panel relative w-full overflow-hidden rounded-2xl px-6 py-6">
          <ActiveOutline />
          <div className="relative z-20">
            {headerLabel ? (
              <p className="text-silver-200 mb-3 text-center text-sm font-medium">{headerLabel}</p>
            ) : null}
            <div className="text-silver-300 mb-2.5 flex justify-between font-mono text-xs font-[560] tracking-[0.08em] uppercase">
              <span>
                Progress: {status.completed_trials} / {status.n_trials} Trials
              </span>
              <span className="text-silver-100 quant-tabular-nums">{pct}%</span>
            </div>
            <div className="bg-carbon-950/85 border-brass-600/10 h-2.5 w-full overflow-hidden rounded-full border shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
              <div
                className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(196,165,116,0.35)] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {isMultiObjective ? (
              <div className="text-silver-400 mt-4 space-y-1 text-center text-xs font-medium tracking-wide">
                <p>
                  Best Return:{' '}
                  <span className="text-brass-400 ml-1 font-mono text-sm font-bold">
                    {formatFractionAsPercent(bestReturn)}
                  </span>
                </p>
                <p>
                  Best Drawdown:{' '}
                  <span className="text-brass-400 ml-1 font-mono text-sm font-bold">
                    {formatFractionAsPercent(bestDrawdown)}
                  </span>
                </p>
              </div>
            ) : (
              status.best_value != null && (
                <p className="text-silver-400 mt-4 text-center text-xs font-medium tracking-wide">
                  Best objective:{' '}
                  <span className="text-brass-400 ml-1 font-mono text-sm font-bold">
                    {status.best_value.toFixed(4)}
                  </span>
                </p>
              )
            )}
            <div className="mt-5 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-carbon-600 text-silver-200 text-xs font-bold tracking-wider uppercase hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-400"
                onClick={onCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Job'}
              </Button>
              {cancelError ? (
                <p className="max-w-xs text-center text-xs text-rose-400">{cancelError}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Best Params Card */}
        {showBestParams && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <BestParamsCard
              results={mockResults}
              backtest={status.backtest_config!}
              trial={status.best_trial}
              title="Best Trial So Far"
            />
          </div>
        )}
      </div>

      {/* Right Column: Live Trials Table */}
      <div className="flex min-h-0 flex-1 flex-col">
        <TrialsTable results={mockResults} />
      </div>
    </div>
  )
}
