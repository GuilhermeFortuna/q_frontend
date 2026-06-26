import type { FeatureEvalRun, FeatureScoreRow } from '@/types/features'

export const METRIC_COLUMNS = ['ic', 'rank_ic', 'mutual_info', 'stability'] as const

export type MetricColumn = (typeof METRIC_COLUMNS)[number]

export function sortLeaderboard(rows: FeatureScoreRow[]): FeatureScoreRow[] {
  return [...rows].sort((left, right) => {
    const leftScore = left.global_score ?? -1
    const rightScore = right.global_score ?? -1
    if (leftScore !== rightScore) {
      return rightScore - leftScore
    }
    return left.feature_name.localeCompare(right.feature_name)
  })
}

export function recommendedFeatureIds(run: FeatureEvalRun): string[] {
  const fromSummary = run.result_summary?.recommended_feature_ids
  if (fromSummary && fromSummary.length > 0) {
    return fromSummary
  }
  return sortLeaderboard(run.leaderboard)
    .filter((row) => row.is_representative)
    .map((row) => row.feature_id)
}

export function weakOrRedundantFeatures(
  leaderboard: FeatureScoreRow[],
  recommendedIds: string[],
): FeatureScoreRow[] {
  const recommended = new Set(recommendedIds)
  return sortLeaderboard(leaderboard).filter(
    (row) => !recommended.has(row.feature_id) || !row.is_representative,
  )
}

export function metricValue(row: FeatureScoreRow, metric: MetricColumn): number | null {
  return row[metric]
}

export function heatmapCellValue(
  row: FeatureEvalRun['heatmap']['rows'][number],
  metric: string,
): number | null {
  if (metric === 'ic') return row.ic
  if (metric === 'rank_ic') return row.rank_ic
  if (metric === 'mutual_info') return row.mutual_info
  if (metric === 'stability') return row.stability
  return null
}

export function divergingColor(value: number | null, metric: MetricColumn): string {
  if (value === null || Number.isNaN(value)) {
    return 'rgba(111, 119, 133, 0.18)'
  }

  const centeredMetric = metric === 'ic' || metric === 'rank_ic'
  if (!centeredMetric) {
    const clamped = Math.max(0, Math.min(1, value))
    const alpha = 0.18 + clamped * 0.55
    return `rgba(196, 165, 116, ${alpha.toFixed(3)})`
  }

  const magnitude = Math.max(-1, Math.min(1, value))
  if (magnitude >= 0) {
    const alpha = 0.18 + magnitude * 0.55
    return `rgba(74, 222, 128, ${alpha.toFixed(3)})`
  }
  const alpha = 0.18 + Math.abs(magnitude) * 0.55
  return `rgba(248, 113, 113, ${alpha.toFixed(3)})`
}

export function featureNameById(leaderboard: FeatureScoreRow[], featureId: string): string {
  return leaderboard.find((row) => row.feature_id === featureId)?.feature_name ?? featureId
}

export function isEvalRunActive(status: FeatureEvalRun['status']): boolean {
  return status === 'pending' || status === 'running'
}

export function stabilitySeries(row: FeatureScoreRow): Array<{ window: string; rank_ic: number }> {
  if (row.window_rank_ics && row.window_rank_ics.length > 0) {
    return row.window_rank_ics.map((value, index) => ({
      window: `W${index + 1}`,
      rank_ic: value ?? 0,
    }))
  }

  return Object.entries(row.regime_ics).map(([label, value]) => ({
    window: label,
    rank_ic: value ?? 0,
  }))
}
