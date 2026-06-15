import type { ObjectiveMode } from '@/types/optimization'
import type { IsMetricsSummary } from '@/types/strategySearch'

export function isSummaryToMetrics(
  summary: IsMetricsSummary | null | undefined,
  mode: ObjectiveMode,
): Record<string, number> | null {
  if (!summary) return null

  const mean = summary.mean_objective
  switch (mode) {
    case 'maximize_net_profit':
      return { total_pnl: mean }
    case 'maximize_sharpe':
      return { sharpe_ratio: mean }
    case 'minimize_drawdown':
      return { max_drawdown_pct: mean }
    case 'maximize_return_drawdown':
    case 'multi_objective_return_drawdown':
      return { return_drawdown_ratio: mean }
    default: {
      const exhaustive: never = mode
      return exhaustive
    }
  }
}

export const GATE_FLAG_LABELS: Record<string, string> = {
  few_windows: 'Too few completed windows',
  few_oos_trades: 'Too few OOS trades',
  low_efficiency: 'Low IS→OOS efficiency',
  suspicious_efficiency: 'Suspiciously high efficiency',
}

export function gateFlagsLabel(flags: string[]): string {
  if (flags.length === 0) return 'Passed all gates'
  return flags.map((flag) => GATE_FLAG_LABELS[flag] ?? flag).join(' · ')
}

export function bestStrategyGloss(efficiency: number | null): string {
  if (efficiency == null) {
    return 'Top OOS score, but efficiency could not be computed across windows.'
  }
  if (efficiency >= 0.6) {
    return 'Strong out-of-sample transfer — best candidate on the leaderboard passed gates with solid IS→OOS efficiency.'
  }
  if (efficiency >= 0.5) {
    return 'Leads on OOS objective, but efficiency is moderate — validate per-window behavior before promoting.'
  }
  if (efficiency <= 0) {
    return 'Highest ranked OOS score, yet efficiency collapsed — treat as a research lead, not a live-ready winner.'
  }
  return 'Leads on OOS objective with weak efficiency — review before promoting to Backtest or Optimize.'
}

export function dsrGloss(dsr: number | null, nTrials: number | null | undefined): string {
  if (dsr == null) return 'Deflated Sharpe not computed for this run.'
  const trials =
    nTrials != null ? `~${nTrials.toLocaleString()} genomes tried` : 'many genomes tried'
  if (dsr >= 0.95) {
    return `DSR ${(dsr * 100).toFixed(0)}% — adjusted for ${trials}; screening signal only, not proof of live edge.`
  }
  if (dsr >= 0.5) {
    return `DSR ${(dsr * 100).toFixed(0)}% after ${trials} — moderate multiple-testing adjustment.`
  }
  return `DSR ${(dsr * 100).toFixed(0)}% after ${trials} — weak after deflation; treat as exploratory.`
}

export const GENETIC_SKEPTIC_COPY =
  'High DSR still does not guarantee live performance; lock-box is a single holdout — treat as screening, not proof.'

export function lockboxDiverged(
  oosSharpe: number | null | undefined,
  lockboxSharpe: number | null | undefined,
  lockboxPassed: boolean | null | undefined,
): boolean {
  if (lockboxPassed === false) return true
  if (oosSharpe == null || lockboxSharpe == null) return false
  if (lockboxSharpe <= 0 && oosSharpe > 0.3) return true
  return oosSharpe > 0 && lockboxSharpe < oosSharpe * 0.5
}
