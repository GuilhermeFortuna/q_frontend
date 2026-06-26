import { formatFeatureScore } from '@/components/research/featureStoreUtils'
import {
  featureNameById,
  recommendedFeatureIds,
  weakOrRedundantFeatures,
} from '@/components/research/featureScoringUtils'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { FeatureEvalRun } from '@/types/features'

type FeatureSetPanelsProps = {
  run: FeatureEvalRun
}

export function FeatureRecommendedSetPanel({ run }: FeatureSetPanelsProps) {
  const recommendedIds = recommendedFeatureIds(run)

  return (
    <Panel className="flex min-h-0 flex-col gap-3 p-4" data-testid="feature-recommended-set-panel">
      <SectionHeader title="Recommended set" />
      {recommendedIds.length === 0 ? (
        <p className="text-silver-400 text-sm">No recommended features yet.</p>
      ) : (
        <ul className="space-y-2">
          {recommendedIds.map((featureId) => {
            const row = run.leaderboard.find((entry) => entry.feature_id === featureId)
            return (
              <li
                key={featureId}
                className="surface-card flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                data-testid={`recommended-feature-${featureNameById(run.leaderboard, featureId)}`}
              >
                <span className="text-cream-100 font-mono">
                  {featureNameById(run.leaderboard, featureId)}
                </span>
                <span className="text-silver-300 font-mono">
                  {formatFeatureScore(row?.global_score ?? null)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export function FeatureWeakRedundantPanel({ run }: FeatureSetPanelsProps) {
  const recommendedIds = recommendedFeatureIds(run)
  const weakRows = weakOrRedundantFeatures(run.leaderboard, recommendedIds)

  return (
    <Panel className="flex min-h-0 flex-col gap-3 p-4" data-testid="feature-weak-redundant-panel">
      <SectionHeader title="Weak / redundant" />
      {weakRows.length === 0 ? (
        <p className="text-silver-400 text-sm">No weak or redundant features in this run.</p>
      ) : (
        <ul className="space-y-2">
          {weakRows.map((row) => (
            <li
              key={row.feature_id}
              className="surface-card flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              data-testid={`weak-feature-${row.feature_name}`}
            >
              <span className="text-cream-100 font-mono">{row.feature_name}</span>
              <span className="text-silver-400 text-xs">
                {row.is_representative ? 'low score' : 'redundant'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
