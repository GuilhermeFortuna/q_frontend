import { formatThreshold } from '@/lib/mlFilters/mlFilterFormat'
import type { MlFilterBacktestSummary, MlFilterConfig } from '../../../contracts/api'

type MLFilterSummaryCardProps = {
  /** Result summary from a completed run; carries candidate counts. */
  summary?: MlFilterBacktestSummary | null
  /** Saved configuration; enough to show the exact version and threshold in history. */
  config?: MlFilterConfig | null
}

export function MLFilterSummaryCard({ summary, config }: MLFilterSummaryCardProps) {
  const modelVersionId = summary?.model_version_id ?? config?.model_version_id
  if (!modelVersionId) return null
  const threshold = summary?.threshold ?? config?.threshold
  const counts: Array<[string, number | undefined]> = [
    ['Scored', summary?.candidates_scored],
    ['Accepted', summary?.candidates_accepted],
    ['Rejected', summary?.candidates_rejected],
    ['Not ready', summary?.candidates_not_ready],
  ]

  return (
    <section
      aria-label="ML filter summary"
      className="border-carbon-600/50 text-silver-300 mb-3 rounded-lg border px-3 py-2 text-xs"
      data-testid="ml-filter-summary"
    >
      <p>
        <span className="text-silver-500">ML filter</span> · model version{' '}
        <code className="text-silver-100">{modelVersionId}</code>
        {threshold !== undefined ? ` · threshold ${formatThreshold(threshold)}` : ''}
        {summary?.dataset_id ? ` · dataset ${summary.dataset_id}` : ''}
      </p>
      {summary ? (
        <p className="text-silver-400 mt-1">
          Candidates:{' '}
          {counts
            .filter(([, value]) => value !== undefined)
            .map(([label, value]) => `${label} ${value}`)
            .join(' · ')}
        </p>
      ) : null}
    </section>
  )
}
