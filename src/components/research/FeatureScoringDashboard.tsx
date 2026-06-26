import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useFeatureEvalRun, useFeatureLeaderboard } from '@/api/queries/features'
import { FeatureLeaderboardPanel } from '@/components/research/FeatureLeaderboardPanel'
import { FeatureMetricHeatmap } from '@/components/research/FeatureMetricHeatmap'
import {
  FeatureRecommendedSetPanel,
  FeatureWeakRedundantPanel,
} from '@/components/research/FeatureSetPanels'
import { FeatureStabilityPanel } from '@/components/research/FeatureStabilityPanel'
import { formatFeatureScore } from '@/components/research/featureStoreUtils'
import { isEvalRunActive } from '@/components/research/featureScoringUtils'
import { RedundancyClusterPanel } from '@/components/research/RedundancyClusterPanel'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { StatTile } from '@/components/ui/StatTile'
import { cn } from '@/lib/utils'
import type { FeatureScoreRow } from '@/types/features'

export type FeatureScoringSource = 'latest' | 'eval'

type FeatureScoringDashboardProps = {
  source: FeatureScoringSource
  runId: string | null
  onSourceChange: (source: FeatureScoringSource) => void
  onRunIdChange: (runId: string) => void
  runOptions: Array<{ runId: string; label: string }>
  onSelectFeature?: (name: string) => void
  onGoToLab?: () => void
}

function EmptyRunState({ onGoToLab }: { onGoToLab?: () => void }) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
      data-testid="feature-scoring-empty"
    >
      <p className="text-silver-300 max-w-md text-sm">
        Run a feature evaluation in the Feature Lab to populate the leaderboard, heatmap, and
        cluster panels.
      </p>
      {onGoToLab ? (
        <Button type="button" onClick={onGoToLab}>
          Open Feature Lab
        </Button>
      ) : null}
    </div>
  )
}

function LatestScoresPanel({ onSelectFeature }: { onSelectFeature?: (name: string) => void }) {
  const leaderboardQuery = useFeatureLeaderboard()

  if (leaderboardQuery.isLoading) {
    return (
      <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading latest scores…
      </div>
    )
  }

  if (leaderboardQuery.isError || !leaderboardQuery.data) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-rose-400">
        Failed to load latest feature scores.
      </div>
    )
  }

  const rows: FeatureScoreRow[] = leaderboardQuery.data.features.map((item, index) => ({
    feature_id: `${item.feature_name}.latest`,
    feature_name: item.feature_name,
    ic: null,
    rank_ic: null,
    mutual_info: null,
    stability: null,
    global_score: item.global_score,
    cluster_id: index,
    is_representative: true,
    leakage_status: 'clean',
    regime_ics: {},
  }))

  return (
    <div className="space-y-4">
      <FeatureLeaderboardPanel rows={rows} onSelectFeature={onSelectFeature} />
    </div>
  )
}

function EvalRunDashboard({
  runId,
  onSelectFeature,
}: {
  runId: string
  onSelectFeature?: (name: string) => void
}) {
  const [isPolling, setIsPolling] = useState(true)
  const runQuery = useFeatureEvalRun(runId, { isRunning: isPolling })

  useEffect(() => {
    if (runQuery.data) {
      setIsPolling(isEvalRunActive(runQuery.data.status))
    }
  }, [runQuery.data])

  const run = runQuery.data
  const isRunning = run ? isEvalRunActive(run.status) : false

  if (runQuery.isLoading && !run) {
    return (
      <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading evaluation results…
      </div>
    )
  }

  if (runQuery.isError || !run) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-rose-400">
        Failed to load feature evaluation results.
      </div>
    )
  }

  const topScore = run.result_summary?.top_global_score ?? run.leaderboard[0]?.global_score ?? null
  const clusterCount = run.result_summary?.cluster_count ?? run.clusters.length

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      data-testid="feature-scoring-dashboard"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-silver-400 text-xs">
          {run.symbol} · {run.timeframe} · {run.target_name}:{run.target_horizon}
        </p>
        {isRunning ? (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase',
              'bg-brass-500/10 text-brass-400',
            )}
            data-testid="feature-scoring-live-badge"
          >
            Live · {run.leaderboard.length} feature{run.leaderboard.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Features evaluated" value={String(run.leaderboard.length)} />
        <StatTile label="Target" value={`${run.target_name}:${run.target_horizon}`} />
        <StatTile label="Clusters" value={String(clusterCount)} />
        <StatTile label="Top score" value={formatFeatureScore(topScore)} highlight />
      </div>

      <div className="grid min-h-0 gap-4 xl:grid-cols-2">
        <FeatureLeaderboardPanel rows={run.leaderboard} onSelectFeature={onSelectFeature} />
        <FeatureMetricHeatmap heatmap={run.heatmap} />
      </div>

      <FeatureStabilityPanel rows={run.leaderboard} />

      <div className="grid gap-4 xl:grid-cols-2">
        <RedundancyClusterPanel clusters={run.clusters} leaderboard={run.leaderboard} />
        <div className="grid gap-4">
          <FeatureRecommendedSetPanel run={run} />
          <FeatureWeakRedundantPanel run={run} />
        </div>
      </div>
    </div>
  )
}

export function FeatureScoringDashboard({
  source,
  runId,
  onSourceChange,
  onRunIdChange,
  runOptions,
  onSelectFeature,
  onGoToLab,
}: FeatureScoringDashboardProps) {
  const pickerOptions = useMemo(
    () => [
      { value: 'latest' as const, label: 'Latest scores' },
      ...runOptions.map((option) => ({
        value: option.runId as string,
        label: option.label,
      })),
    ],
    [runOptions],
  )

  const pickerValue = source === 'latest' ? 'latest' : (runId ?? 'latest')

  const handlePickerChange = (value: string) => {
    if (value === 'latest') {
      onSourceChange('latest')
      return
    }
    onSourceChange('eval')
    onRunIdChange(value)
  }

  return (
    <Panel className="flex h-full min-h-0 flex-col gap-4 p-4" data-testid="research-tab-scoring">
      <div className="flex flex-col gap-3">
        <SectionHeader title="Feature Scoring" />
        <SegmentedToggle
          aria-label="Feature scoring run picker"
          options={pickerOptions}
          value={pickerValue}
          onChange={handlePickerChange}
        />
      </div>

      {source === 'latest' ? (
        <LatestScoresPanel onSelectFeature={onSelectFeature} />
      ) : runId ? (
        <EvalRunDashboard runId={runId} onSelectFeature={onSelectFeature} />
      ) : (
        <EmptyRunState onGoToLab={onGoToLab} />
      )}
    </Panel>
  )
}
