import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { FeatureLab, type FeatureLabRecentRun } from '@/components/research/FeatureLab'
import { FeaturePassport } from '@/components/research/FeaturePassport'
import {
  FeatureScoringDashboard,
  type FeatureScoringSource,
} from '@/components/research/FeatureScoringDashboard'
import { MLFiltersTab } from '@/components/research/ml-filters/MLFiltersTab'
import { NeuralFeaturesTab } from '@/components/research/neural/NeuralFeaturesTab'
import { FeatureStorePanel } from '@/components/research/FeatureStoreTable'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { toast } from '@/components/ui/toast'
import { prepareMlFilterBacktest } from '@/lib/mlFilters/prepareMlFilterBacktest'
import { useAppStore } from '@/store/useAppStore'
import { ExperimentsWorkspace } from '@/workspaces/research/ExperimentsWorkspace'
import type { ResearchTab } from '@/types/features'

const TAB_OPTIONS: { value: ResearchTab; label: string }[] = [
  { value: 'store', label: 'Feature Store' },
  { value: 'scoring', label: 'Feature Scoring' },
  { value: 'lab', label: 'Feature Lab' },
  { value: 'neural', label: 'Neural Features' },
  { value: 'ml-filters', label: 'ML Filters' },
  { value: 'experiments', label: 'Experiments' },
]

type ResearchWorkspaceProps = {
  tab?: ResearchTab
  sourceRunId?: string
}

function FeatureStoreTab() {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)

  return (
    <div
      className="flex min-h-0 flex-1 gap-4 overflow-hidden"
      data-workspace-transition-surface="secondary"
    >
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

export function ResearchWorkspace({ tab = 'store', sourceRunId }: ResearchWorkspaceProps) {
  const navigate = useNavigate({ from: '/research' })
  const queryClient = useQueryClient()
  const setPendingBacktestConfig = useAppStore((state) => state.setPendingBacktestConfig)
  const patchBacktestSession = useAppStore((state) => state.patchBacktestSession)
  // Default to the aggregate "Latest scores" leaderboard so the Scoring tab shows
  // persisted results on load; a started eval switches this to 'eval' + a runId.
  const [scoringSource, setScoringSource] = useState<FeatureScoringSource>('latest')
  // Start with no run selected — the Scoring tab shows its "run an evaluation" empty
  // state until a real eval is started from the Lab (no mock run id seeded).
  const [scoringRunId, setScoringRunId] = useState<string | null>(null)
  const [recentRuns, setRecentRuns] = useState<FeatureLabRecentRun[]>([])
  const [neuralTrainingJobId, setNeuralTrainingJobId] = useState<string | null>(null)

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

  const handleUseMlFilterInBacktest = async (modelVersionId: string) => {
    try {
      const request = await prepareMlFilterBacktest(queryClient, modelVersionId)
      setPendingBacktestConfig(request)
      patchBacktestSession({ workflowMode: 'backtest', focus: 'setup', rightPanelTab: 'results' })
      void navigate({ to: '/backtests' })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Cannot use this model in a backtest: ${error.message}`
          : 'Cannot use this model in a backtest.',
      )
    }
  }

  const handleNeuralTrainingStarted = (jobId: string) => {
    setNeuralTrainingJobId(jobId)
  }

  return (
    <div
      className="text-silver-100 flex h-[calc(100dvh-4.5rem-7rem)] w-full flex-col gap-4 overflow-hidden px-4 py-4"
      data-testid="research-workspace"
      data-workspace-transition-root="research"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-cream-100 font-mono text-lg font-semibold tracking-wide"
            data-workspace-transition-anchor="research"
          >
            Research
          </h1>
          <p className="text-silver-400 text-sm">
            Feature intelligence workspace — store, scoring, lab, neural models, ML entry filters,
            and experiments.
          </p>
        </div>
        <SegmentedToggle
          aria-label="Research workspace tabs"
          options={TAB_OPTIONS}
          value={tab}
          onChange={handleTabChange}
        />
      </div>

      <div className="min-h-0 flex-1" data-workspace-transition-surface="primary">
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
        {tab === 'neural' ? (
          <NeuralFeaturesTab
            activeTrainingJobId={neuralTrainingJobId}
            onTrainingStarted={handleNeuralTrainingStarted}
            onClearTrainingJob={() => setNeuralTrainingJobId(null)}
          />
        ) : null}
        {tab === 'ml-filters' ? (
          <MLFiltersTab sourceRunId={sourceRunId} onUseInBacktest={handleUseMlFilterInBacktest} />
        ) : null}
        {tab === 'experiments' ? <ExperimentsWorkspace /> : null}
      </div>
    </div>
  )
}
