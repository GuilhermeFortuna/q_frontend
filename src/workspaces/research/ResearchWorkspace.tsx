import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { FeatureLab, type FeatureLabRecentRun } from '@/components/research/FeatureLab'
import { FeaturePassport } from '@/components/research/FeaturePassport'
import {
  FeatureScoringDashboard,
  type FeatureScoringSource,
} from '@/components/research/FeatureScoringDashboard'
import { FeatureStorePanel } from '@/components/research/FeatureStoreTable'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import type { ResearchTab } from '@/types/features'

// Neural Features tab is intentionally deferred until backend Phase 3/4 lands.

const TAB_OPTIONS: { value: ResearchTab; label: string }[] = [
  { value: 'store', label: 'Feature Store' },
  { value: 'scoring', label: 'Feature Scoring' },
  { value: 'lab', label: 'Feature Lab' },
]

type ResearchWorkspaceProps = {
  tab?: ResearchTab
}

function FeatureStoreTab() {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <FeatureStorePanel onSelectFeature={setSelectedFeature} />
      </div>
      {selectedFeature ? (
        <FeaturePassport name={selectedFeature} onClose={() => setSelectedFeature(null)} />
      ) : null}
    </div>
  )
}

type FeatureScoringTabProps = {
  source: FeatureScoringSource
  runId: string | null
  runOptions: Array<{ runId: string; label: string }>
  onSourceChange: (source: FeatureScoringSource) => void
  onRunIdChange: (runId: string) => void
  onGoToLab: () => void
}

function FeatureScoringTab({
  source,
  runId,
  runOptions,
  onSourceChange,
  onRunIdChange,
  onGoToLab,
}: FeatureScoringTabProps) {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <FeatureScoringDashboard
          source={source}
          runId={runId}
          onSourceChange={onSourceChange}
          onRunIdChange={onRunIdChange}
          runOptions={runOptions}
          onSelectFeature={setSelectedFeature}
          onGoToLab={onGoToLab}
        />
      </div>
      {selectedFeature ? (
        <FeaturePassport name={selectedFeature} onClose={() => setSelectedFeature(null)} />
      ) : null}
    </div>
  )
}

type FeatureLabTabProps = {
  recentRuns: FeatureLabRecentRun[]
  onEvalStarted: (runId: string, label: string) => void
  onOpenRun: (runId: string) => void
}

function FeatureLabTab({ recentRuns, onEvalStarted, onOpenRun }: FeatureLabTabProps) {
  return <FeatureLab recentRuns={recentRuns} onEvalStarted={onEvalStarted} onOpenRun={onOpenRun} />
}

export function ResearchWorkspace({ tab = 'store' }: ResearchWorkspaceProps) {
  const navigate = useNavigate({ from: '/research' })
  const [scoringSource, setScoringSource] = useState<FeatureScoringSource>('eval')
  // Start with no run selected — the Scoring tab shows its "run an evaluation" empty
  // state until a real eval is started from the Lab (no mock run id seeded).
  const [scoringRunId, setScoringRunId] = useState<string | null>(null)
  const [recentRuns, setRecentRuns] = useState<FeatureLabRecentRun[]>([])

  const scoringRunOptions = useMemo(
    () =>
      recentRuns.map((run) => ({
        runId: run.runId,
        label: run.label,
      })),
    [recentRuns],
  )

  const handleTabChange = (nextTab: ResearchTab) => {
    void navigate({ search: { tab: nextTab } })
  }

  const handleGoToLab = () => {
    void navigate({ search: { tab: 'lab' } })
  }

  const recordRecentRun = (runId: string, label: string) => {
    setRecentRuns((current) => {
      const withoutDuplicate = current.filter((run) => run.runId !== runId)
      return [{ runId, label }, ...withoutDuplicate].slice(0, 8)
    })
  }

  const handleEvalStarted = (runId: string, label: string) => {
    setScoringRunId(runId)
    setScoringSource('eval')
    recordRecentRun(runId, label)
    void navigate({ search: { tab: 'scoring' } })
  }

  const handleOpenRunInScoring = (runId: string) => {
    setScoringRunId(runId)
    setScoringSource('eval')
    void navigate({ search: { tab: 'scoring' } })
  }

  return (
    <div
      className="text-silver-100 flex h-[calc(100dvh-4.5rem-7rem)] w-full flex-col gap-4 overflow-hidden px-4 py-4"
      data-testid="research-workspace"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-cream-100 font-mono text-lg font-semibold tracking-wide">Research</h1>
          <p className="text-silver-400 text-sm">
            Feature intelligence workspace — store, scoring, and lab.
          </p>
        </div>
        <SegmentedToggle
          aria-label="Research workspace tabs"
          options={TAB_OPTIONS}
          value={tab}
          onChange={handleTabChange}
        />
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'store' ? <FeatureStoreTab /> : null}
        {tab === 'scoring' ? (
          <FeatureScoringTab
            source={scoringSource}
            runId={scoringRunId}
            runOptions={scoringRunOptions}
            onSourceChange={setScoringSource}
            onRunIdChange={setScoringRunId}
            onGoToLab={handleGoToLab}
          />
        ) : null}
        {tab === 'lab' ? (
          <FeatureLabTab
            recentRuns={recentRuns}
            onEvalStarted={handleEvalStarted}
            onOpenRun={handleOpenRunInScoring}
          />
        ) : null}
      </div>
    </div>
  )
}
