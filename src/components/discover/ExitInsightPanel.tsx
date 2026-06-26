import {
  exitReasonRows,
  formatCaptureRatio,
  formatExitMetric,
  formatExitPnl,
  formatExitWinRate,
  candidateExitLabel,
  hasExitInsight,
  holdingPeriodLabel,
  resolveExitQuality,
} from '@/lib/discover/exitInsights'
import type { CandidateResult } from '@/types/strategySearch'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatTile } from '@/components/ui/StatTile'

type ExitInsightPanelProps = {
  candidate: CandidateResult
}

export function ExitInsightPanel({ candidate }: ExitInsightPanelProps) {
  if (!hasExitInsight(candidate)) {
    return null
  }

  const exitLabel = candidateExitLabel(candidate)
  const exitQuality = resolveExitQuality(candidate)
  const reasons = exitReasonRows(exitQuality)
  const pathQuality = exitQuality?.path_quality
  const holdingLabel = holdingPeriodLabel(exitQuality?.holding_period)

  const pathStats: Array<{ label: string; value: string }> = []
  if (pathQuality?.avg_mfe_capture_ratio != null) {
    pathStats.push({
      label: 'MFE captured',
      value: formatCaptureRatio(pathQuality.avg_mfe_capture_ratio),
    })
  }
  if (pathQuality?.avg_profit_giveback != null) {
    pathStats.push({
      label: 'Avg giveback',
      value: formatExitMetric(pathQuality.avg_profit_giveback),
    })
  }
  if (pathQuality?.avg_mae != null) {
    pathStats.push({
      label: 'Avg MAE',
      value: formatExitMetric(pathQuality.avg_mae),
    })
  }
  if (holdingLabel) {
    pathStats.push({ label: 'Hold', value: holdingLabel.replace(/^Median hold /, '') })
  }

  return (
    <div className="border-carbon-600/30 mt-4 space-y-4 border-t pt-4">
      {exitLabel ? (
        <div>
          <SectionHeader title="Exit policy" />
          <p className="text-silver-200 mt-2 text-sm">{exitLabel}</p>
        </div>
      ) : null}

      {reasons.length > 0 ? (
        <div>
          <SectionHeader title="Exit distribution" />
          <ul className="mt-2 space-y-1.5">
            {reasons.map((row) => (
              <li
                key={row.reason}
                className="text-silver-300 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 font-mono text-xs"
              >
                <span className="text-silver-200 min-w-0 truncate">{row.reason}</span>
                <span className="text-silver-400 shrink-0 tabular-nums">
                  {row.trades} trades · {formatExitWinRate(row.win_rate)} ·{' '}
                  <span
                    className={
                      (row.total_pnl ?? 0) >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'
                    }
                  >
                    {formatExitPnl(row.total_pnl)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pathStats.length > 0 ? (
        <div>
          <SectionHeader title="Path quality" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {pathStats.map((stat) => (
              <StatTile key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
