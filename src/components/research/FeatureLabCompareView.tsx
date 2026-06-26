import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useFeatureEvalRun } from '@/api/queries/features'
import { FeatureLeaderboardPanel } from '@/components/research/FeatureLeaderboardPanel'
import { isEvalRunActive } from '@/components/research/featureScoringUtils'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'

type FeatureLabCompareViewProps = {
  runIdA: string
  runIdB: string
  labelA: string
  labelB: string
}

function CompareRunPanel({ runId, label }: { runId: string; label: string }) {
  const [isPolling, setIsPolling] = useState(true)
  const runQuery = useFeatureEvalRun(runId, { isRunning: isPolling })

  useEffect(() => {
    if (runQuery.data) {
      setIsPolling(isEvalRunActive(runQuery.data.status))
    }
  }, [runQuery.data])

  if (runQuery.isLoading && !runQuery.data) {
    return (
      <div className="text-silver-400 flex min-h-[200px] items-center justify-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading {label}…
      </div>
    )
  }

  if (runQuery.isError || !runQuery.data) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-rose-400">
        Failed to load {label}.
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid={`feature-lab-compare-run-${runId}`}>
      <p className="text-silver-400 text-xs">{label}</p>
      <FeatureLeaderboardPanel rows={runQuery.data.leaderboard} />
    </div>
  )
}

export function FeatureLabCompareView({
  runIdA,
  runIdB,
  labelA,
  labelB,
}: FeatureLabCompareViewProps) {
  return (
    <Panel className="flex min-h-0 flex-col gap-4 p-4" data-testid="feature-lab-compare-view">
      <SectionHeader title="Set comparison" />
      <div className="grid min-h-0 gap-4 xl:grid-cols-2">
        <CompareRunPanel runId={runIdA} label={labelA} />
        <CompareRunPanel runId={runIdB} label={labelB} />
      </div>
    </Panel>
  )
}
