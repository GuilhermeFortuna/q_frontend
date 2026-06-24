import { isMultiObjectiveObjectiveMode } from '@/lib/optimize/multiObjectiveMetrics'
import type { OptimizationResults, OptimizationStatus } from '@/types/optimization'

/** Build a results-shaped view from live status polling (running studies). */
export function buildResultsFromStatus(status: OptimizationStatus): OptimizationResults {
  const objectiveMode = status.optimization_config?.objective.mode ?? 'maximize_net_profit'
  const isMultiObjective = isMultiObjectiveObjectiveMode(objectiveMode)

  return {
    study_id: status.study_id,
    objective_mode: objectiveMode,
    is_multi_objective: isMultiObjective,
    best_params: status.best_params,
    best_trial: status.best_trial ?? null,
    trials: status.trials ?? [],
    pareto_trials: [],
    failures: [],
  }
}
