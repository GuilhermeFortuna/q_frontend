import type { ObjectiveMode } from '@/types/optimization'

export function objectiveMetricLabel(mode: ObjectiveMode): string {
  switch (mode) {
    case 'maximize_net_profit':
      return 'Net profit'
    case 'maximize_sharpe':
      return 'Sharpe ratio'
    case 'minimize_drawdown':
      return 'Max drawdown %'
    case 'maximize_return_drawdown':
    case 'multi_objective_return_drawdown':
      return 'Return / drawdown'
    default: {
      const exhaustive: never = mode
      return exhaustive
    }
  }
}

export function objectiveMetricValue(
  metrics: Record<string, number> | null | undefined,
  mode: ObjectiveMode,
): number | null {
  if (!metrics) {
    return null
  }

  switch (mode) {
    case 'maximize_net_profit':
      return metrics.total_pnl ?? null
    case 'maximize_sharpe':
      return metrics.sharpe_ratio ?? null
    case 'minimize_drawdown':
      return metrics.max_drawdown_pct ?? null
    case 'maximize_return_drawdown':
    case 'multi_objective_return_drawdown':
      return metrics.return_drawdown_ratio ?? null
    default: {
      const exhaustive: never = mode
      return exhaustive
    }
  }
}

export function formatObjectiveMetricValue(value: number | null, mode: ObjectiveMode): string {
  if (value == null || Number.isNaN(value)) {
    return '—'
  }

  switch (mode) {
    case 'maximize_net_profit':
      return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    case 'maximize_sharpe':
    case 'maximize_return_drawdown':
    case 'multi_objective_return_drawdown':
      return value.toFixed(3)
    case 'minimize_drawdown':
      return `${(value * 100).toFixed(2)}%`
    default: {
      const exhaustive: never = mode
      return exhaustive
    }
  }
}

export function formatEfficiencyRatio(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—'
  }
  return value.toFixed(2)
}
