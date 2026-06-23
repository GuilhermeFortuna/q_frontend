import { CHART_COLORS } from '@/components/backtests/chartUtils'
import type { OptimizationResults } from '@/types/optimization'

export type ScatterPoint = { x: number; y: number; n: number; fill: string }

function toPoint(x: number, y: number, trialNumber: number, fill: string): ScatterPoint {
  return { x, y, n: trialNumber, fill }
}

export type OptimizationScatterData =
  | { mode: 'empty' }
  | { mode: 'single'; points: ScatterPoint[]; xLabel: string; yLabel: string }
  | { mode: 'pareto'; points: ScatterPoint[]; xLabel: string; yLabel: string }

/** Precompute scatter chart points once per results identity — avoids O(n) work each render. */
export function prepareOptimizationScatterData(
  results: OptimizationResults,
  highlightNumber: number | undefined,
): OptimizationScatterData {
  const completed = results.trials.filter((t) => t.values && t.values.length > 0)
  if (completed.length === 0) {
    return { mode: 'empty' }
  }

  const bestNumber = results.best_trial?.number

  if (results.is_multi_objective) {
    const paretoNumbers = new Set(results.pareto_trials.map((t) => t.number))
    const points = completed.map((trial) => {
      const onPareto = paretoNumbers.has(trial.number)
      const fill =
        trial.number === highlightNumber
          ? '#ffd700'
          : trial.number === bestNumber
            ? CHART_COLORS.equity
            : onPareto
              ? CHART_COLORS.equity
              : CHART_COLORS.reference
      return toPoint(trial.values![0], trial.values![1], trial.number, fill)
    })

    return {
      mode: 'pareto',
      points,
      xLabel: 'Return',
      yLabel: 'Drawdown',
    }
  }

  const points = completed.map((trial) => {
    const fill =
      trial.number === highlightNumber
        ? '#ffd700'
        : trial.number === bestNumber
          ? CHART_COLORS.equity
          : CHART_COLORS.reference
    return toPoint(trial.number, trial.values![0], trial.number, fill)
  })

  return {
    mode: 'single',
    points,
    xLabel: 'Trial',
    yLabel: 'Objective',
  }
}
