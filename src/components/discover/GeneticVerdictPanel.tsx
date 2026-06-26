import { GENETIC_SKEPTIC_COPY, dsrGloss, lockboxDiverged } from '@/lib/discover/candidateMetrics'
import { cn } from '@/lib/utils'
import type { CandidateResult, StrategySearchSummary } from '@/types/strategySearch'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatTile } from '@/components/ui/StatTile'

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
    <Panel
      className={cn(
        'shrink-0 p-4',
        diverged ? 'border-rose-500/40 bg-rose-500/5' : 'border-brass-500/30 bg-brass-500/5',
      )}
    >
      <SectionHeader
        title="Overfitting defense"
        right={
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
        }
      />
      <p className="text-silver-200 mt-3 text-sm">
        {dsrGloss(summary.champion_dsr ?? null, summary.n_trials_effective)}
      </p>
      <p className="text-silver-400 mt-1 text-xs">
        {summary.generations_completed ?? '—'} generations ·{' '}
        {summary.total_genomes_evaluated?.toLocaleString() ?? '—'} genomes evaluated · OOS Sharpe{' '}
        {formatSharpe(summary.sr_observed ?? oosSharpe)}
      </p>

      {summary.lockbox_metrics ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <StatTile
            label="Walk-forward OOS"
            value={`Sharpe ${formatSharpe(oosSharpe)}`}
            delta={`${best?.oos_metrics?.total_trades ?? '—'} trades`}
          />
          <StatTile
            label="Lock-box holdout"
            value={`Sharpe ${formatSharpe(lockboxSharpe)}`}
            delta={`${summary.lockbox_metrics.total_trades ?? '—'} trades`}
            valueTone={diverged ? 'down' : 'neutral'}
            highlight={!diverged}
          />
        </div>
      ) : null}

      <p className="text-silver-500 mt-4 text-xs italic">{GENETIC_SKEPTIC_COPY}</p>
    </Panel>
  )
}
