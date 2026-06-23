import type { CandidateResult, ExitQualitySummary } from '@/types/strategySearch'

export function resolveExitQuality(
  candidate: CandidateResult,
): ExitQualitySummary | null | undefined {
  return candidate.exit_quality ?? candidate.diagnostics?.exit_quality
}

export function candidateExitLabel(candidate: CandidateResult): string | null {
  return candidate.exit_preset_label ?? candidate.exit_policy_label ?? null
}

export function candidateExitDisplayLabel(candidate: CandidateResult): {
  label: string
  explicit: boolean
} {
  const label = candidateExitLabel(candidate)
  if (label != null) {
    return { label, explicit: true }
  }
  return { label: 'Signal exit', explicit: false }
}

export function hasExitInsight(candidate: CandidateResult): boolean {
  return candidateExitLabel(candidate) != null || resolveExitQuality(candidate) != null
}

export function exitReasonRows(exitQuality: ExitQualitySummary | null | undefined) {
  const byReason = exitQuality?.by_reason
  if (!byReason) return []

  return Object.entries(byReason)
    .map(([reason, stats]) => ({
      reason,
      trades: stats.trades,
      total_pnl: stats.total_pnl ?? null,
      win_rate: stats.win_rate ?? null,
    }))
    .sort((a, b) => (b.total_pnl ?? 0) - (a.total_pnl ?? 0))
}

export function formatExitPnl(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  const rounded = Math.round(value)
  const prefix = rounded > 0 ? '+' : ''
  return `${prefix}${rounded.toLocaleString()}`
}

export function formatExitWinRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Math.round(value * 100)}%`
}

export function formatCaptureRatio(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Math.round(value * 100)}%`
}

export function formatExitMetric(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return Math.round(value).toLocaleString()
}

export function holdingPeriodLabel(
  holding: ExitQualitySummary['holding_period'] | undefined,
): string | null {
  if (!holding) return null

  if (holding.median_bars != null) {
    const p90 = holding.p90_bars != null ? ` · p90 ${Math.round(holding.p90_bars)} bars` : ''
    return `Median hold ${Math.round(holding.median_bars)} bars${p90}`
  }

  if (holding.median_minutes != null) {
    return `Median hold ${Math.round(holding.median_minutes)} min`
  }

  return null
}
