import { Star } from 'lucide-react'

import { featureNameById } from '@/components/research/featureScoringUtils'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { GlowCard } from '@/components/ui/spotlight-card'
import { cn } from '@/lib/utils'
import type { FeatureEvalCluster, FeatureScoreRow } from '@/types/features'

type RedundancyClusterPanelProps = {
  clusters: FeatureEvalCluster[]
  leaderboard: FeatureScoreRow[]
}

export function RedundancyClusterPanel({ clusters, leaderboard }: RedundancyClusterPanelProps) {
  return (
    <Panel className="flex min-h-0 flex-col gap-3 p-4" data-testid="redundancy-cluster-panel">
      <SectionHeader title="Correlation clusters" />
      {clusters.length === 0 ? (
        <p className="text-silver-400 text-sm">
          Clusters will appear as the evaluation progresses.
        </p>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster) => (
            <GlowCard
              key={cluster.cluster_id}
              intensity="card"
              className="rounded-lg p-3"
              data-testid={`cluster-card-${cluster.cluster_id}`}
            >
              <div className="text-silver-400 mb-2 text-[10px] font-bold tracking-wider uppercase">
                Cluster {cluster.cluster_id}
              </div>
              <div className="flex flex-wrap gap-2">
                {cluster.feature_ids.map((featureId) => {
                  const isRepresentative = featureId === cluster.representative
                  const featureName = featureNameById(leaderboard, featureId)
                  return (
                    <span
                      key={featureId}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                        isRepresentative
                          ? 'accent-state text-gold-400'
                          : 'bg-silver-500/10 text-silver-300',
                      )}
                      data-testid={`cluster-member-${featureName}`}
                    >
                      {isRepresentative ? (
                        <Star
                          className="h-3 w-3"
                          data-testid={`cluster-representative-${featureName}`}
                        />
                      ) : null}
                      {featureName}
                    </span>
                  )
                })}
              </div>
            </GlowCard>
          ))}
        </div>
      )}
    </Panel>
  )
}
