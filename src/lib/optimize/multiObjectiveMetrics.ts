import type { ObjectiveMode, OptimizationTrial } from '@/types/optimization'

export function isMultiObjectiveObjectiveMode(mode: ObjectiveMode | undefined): boolean {
  return mode === 'multi_objective_return_drawdown'
}

export function getCompletedTrialsWithValues(trials: OptimizationTrial[]): OptimizationTrial[] {
  return trials.filter((trial) => {
    const status = trial.user_attrs.status ?? trial.state.toLowerCase()
    return status === 'complete' && trial.values != null && trial.values.length >= 2
  })
}

export function computeBestMultiObjectiveMetrics(trials: OptimizationTrial[]): {
  bestReturn: number | null
  bestDrawdown: number | null
} {
  const completed = getCompletedTrialsWithValues(trials)
  if (completed.length === 0) {
    return { bestReturn: null, bestDrawdown: null }
  }

  const returns = completed.map((t) => t.values![0])
  const drawdowns = completed.map((t) => t.values![1])

  return {
    bestReturn: Math.max(...returns),
    bestDrawdown: Math.min(...drawdowns),
  }
}

export function formatFractionAsPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—'
  }
  return `${(value * 100).toFixed(2)}%`
}

export function formatMultiObjectiveTrialValues(values: number[] | null | undefined): string {
  if (!values || values.length < 2) {
    return '—'
  }
  return `Return: ${formatFractionAsPercent(values[0])}, Drawdown: ${formatFractionAsPercent(values[1])}`
}

export function formatMultiObjectiveTeaserValues(values: number[] | null | undefined): string {
  if (!values || values.length < 2) {
    return '—'
  }
  return `Ret: ${formatFractionAsPercent(values[0])}, DD: ${formatFractionAsPercent(values[1])}`
}
