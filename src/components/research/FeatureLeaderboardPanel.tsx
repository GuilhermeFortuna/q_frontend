import { AlertTriangle, Star } from 'lucide-react'

import { formatFeatureScore } from '@/components/research/featureStoreUtils'
import { sortLeaderboard } from '@/components/research/featureScoringUtils'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cn } from '@/lib/utils'
import type { FeatureScoreRow } from '@/types/features'

type FeatureLeaderboardPanelProps = {
  rows: FeatureScoreRow[]
  onSelectFeature?: (name: string) => void
}

function LeakageBadge({ status }: { status: string }) {
  if (status === 'clean') {
    return null
  }

  return (
    <span
      className="text-brass-400 inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase"
      data-testid="feature-leaderboard-leakage-badge"
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {status}
    </span>
  )
}

export function FeatureLeaderboardPanel({ rows, onSelectFeature }: FeatureLeaderboardPanelProps) {
  const sortedRows = sortLeaderboard(rows)

  return (
    <Panel className="flex min-h-0 flex-col gap-3 p-4" data-testid="feature-leaderboard-panel">
      <SectionHeader title="Leaderboard" />
      <div className="min-h-0 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-silver-400 text-left text-[10px] font-bold tracking-wider uppercase">
              <th className="px-2 py-2">Feature</th>
              <th className="px-2 py-2 text-right">Score</th>
              <th className="px-2 py-2 text-right">Rank IC</th>
              <th className="px-2 py-2 text-right">Stability</th>
              <th className="px-2 py-2 text-right">Cluster</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.feature_id}
                className={cn(
                  'border-silver-800/60 hover:bg-silver-900/40 border-t transition-colors',
                  onSelectFeature && 'cursor-pointer',
                )}
                onClick={() => onSelectFeature?.(row.feature_name)}
                data-testid={`feature-leaderboard-row-${row.feature_name}`}
              >
                <td className="text-cream-100 px-2 py-2 font-mono">
                  <span className="inline-flex items-center gap-2">
                    {row.feature_name}
                    {row.is_representative ? (
                      <Star
                        className="text-gold-400 h-3 w-3"
                        aria-label="Cluster representative"
                        data-testid={`representative-${row.feature_name}`}
                      />
                    ) : null}
                    <LeakageBadge status={row.leakage_status} />
                  </span>
                </td>
                <td className="text-silver-100 px-2 py-2 text-right font-mono">
                  {formatFeatureScore(row.global_score)}
                </td>
                <td className="text-silver-300 px-2 py-2 text-right font-mono">
                  {formatFeatureScore(row.rank_ic)}
                </td>
                <td className="text-silver-300 px-2 py-2 text-right font-mono">
                  {formatFeatureScore(row.stability)}
                </td>
                <td className="text-silver-300 px-2 py-2 text-right font-mono">
                  {row.cluster_id ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
