import type { OptimizationTrial } from '@/types/optimization'

export type TrialSortKey =
  | 'number'
  | 'objective'
  | 'total_pnl'
  | 'sharpe_ratio'
  | 'max_drawdown_pct'

function metric(trial: OptimizationTrial, key: string): number | null {
  const value = trial.user_attrs.metrics?.[key]
  return value ?? null
}

function objectiveSortValue(trial: OptimizationTrial): number {
  return trial.values?.[0] ?? -Infinity
}

export function sortOptimizationTrials(
  trials: OptimizationTrial[],
  sortKey: TrialSortKey,
  sortAsc: boolean,
): OptimizationTrial[] {
  const sorted = [...trials]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'number':
        cmp = a.number - b.number
        break
      case 'objective':
        cmp = objectiveSortValue(a) - objectiveSortValue(b)
        break
      case 'total_pnl':
        cmp = (metric(a, 'total_pnl') ?? -Infinity) - (metric(b, 'total_pnl') ?? -Infinity)
        break
      case 'sharpe_ratio':
        cmp = (metric(a, 'sharpe_ratio') ?? -Infinity) - (metric(b, 'sharpe_ratio') ?? -Infinity)
        break
      case 'max_drawdown_pct':
        cmp =
          (metric(a, 'max_drawdown_pct') ?? Infinity) - (metric(b, 'max_drawdown_pct') ?? Infinity)
        break
    }
    return sortAsc ? cmp : -cmp
  })
  return sorted
}
