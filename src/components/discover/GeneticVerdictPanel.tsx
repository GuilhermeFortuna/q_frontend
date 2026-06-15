import { GENETIC_SKEPTIC_COPY, dsrGloss, lockboxDiverged } from '@/lib/discover/candidateMetrics'
import { cn } from '@/lib/utils'
import type { CandidateResult, StrategySearchSummary } from '@/types/strategySearch'

type GeneticVerdictPanelProps = {
  summary: StrategySearchSummary
  best: CandidateResult | null
}

function formatSharpe(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toFixed(2)
}

export function GeneticVerdictPanel({ summary, best }: GeneticVerdictPanelProps) {
  const oosSharpe = best?.oos_metrics?.sharpe_ratio ?? summary.sr_observed
  const lockboxSharpe = summary.lockbox_metrics?.sharpe_ratio
  const diverged = lockboxDiverged(oosSharpe, lockboxSharpe, summary.lockbox_passed)

  return (
    <div
      className={cn(
        'shrink-0 rounded-xl border p-4',
        diverged ? 'border-rose-500/40 bg-rose-500/5' : 'border-brass-500/30 bg-brass-500/5',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-silver-400 text-xs font-semibold tracking-wider uppercase">
            Overfitting defense
          </p>
          <p className="text-silver-200 mt-2 text-sm">
            {dsrGloss(summary.champion_dsr ?? null, summary.n_trials_effective)}
          </p>
          <p className="text-silver-400 mt-1 text-xs">
            {summary.generations_completed ?? '—'} generations ·{' '}
            {summary.total_genomes_evaluated?.toLocaleString() ?? '—'} genomes evaluated · OOS
            Sharpe {formatSharpe(summary.sr_observed ?? oosSharpe)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.champion_dsr != null ? (
            <span className="bg-carbon-950/60 text-brass-300 rounded-full px-3 py-1 font-mono text-xs">
              DSR {(summary.champion_dsr * 100).toFixed(0)}%
            </span>
          ) : null}
          {summary.lockbox_passed != null ? (
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase',
                summary.lockbox_passed
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400',
              )}
            >
              Lock-box {summary.lockbox_passed ? 'passed' : 'failed'}
            </span>
          ) : null}
        </div>
      </div>

      {summary.lockbox_metrics ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border-carbon-600/30 rounded-lg border px-3 py-2">
            <p className="text-silver-500 text-[10px] font-semibold tracking-wider uppercase">
              Walk-forward OOS
            </p>
            <p className="text-silver-100 mt-1 font-mono text-sm">
              Sharpe {formatSharpe(oosSharpe)} · trades {best?.oos_metrics?.total_trades ?? '—'}
            </p>
          </div>
          <div
            className={cn(
              'rounded-lg border px-3 py-2',
              diverged ? 'border-rose-500/30 bg-rose-500/5' : 'border-carbon-600/30',
            )}
          >
            <p className="text-silver-500 text-[10px] font-semibold tracking-wider uppercase">
              Lock-box holdout
            </p>
            <p className="text-silver-100 mt-1 font-mono text-sm">
              Sharpe {formatSharpe(lockboxSharpe)} · trades{' '}
              {summary.lockbox_metrics.total_trades ?? '—'}
            </p>
          </div>
        </div>
      ) : null}

      <p className="text-silver-500 mt-4 text-xs italic">{GENETIC_SKEPTIC_COPY}</p>
    </div>
  )
}
