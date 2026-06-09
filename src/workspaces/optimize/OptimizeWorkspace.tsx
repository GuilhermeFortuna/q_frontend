import axios from 'axios'
import { useEffect, useState } from 'react'

import {
  useCancelOptimization,
  useOptimizationResults,
  useOptimizationStatus,
  useStartOptimization,
} from '@/api/queries/optimize'
import { OptimizationHistoryPanel } from '@/components/optimize/OptimizationHistoryPanel'
import { OptimizationResultsPanel } from '@/components/optimize/OptimizationResultsPanel'
import { OptimizationWorkbench } from '@/components/optimize/OptimizationWorkbench'
import { OptimizeConfigForm } from '@/components/optimize/OptimizeConfigForm'
import { cn } from '@/lib/utils'
import type {
  JobStatus,
  OptimizationBacktestConfig,
  OptimizationConfig,
} from '@/types/optimization'

type RightPanelTab = 'results' | 'history'

const RIGHT_PANEL_TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'history', label: 'History' },
]

export function OptimizeWorkspace() {
  const [studyId, setStudyId] = useState<string | null>(null)
  const [submittedConfig, setSubmittedConfig] = useState<OptimizationConfig | null>(null)
  const [studyBacktestConfigs, setStudyBacktestConfigs] = useState<
    Record<string, OptimizationBacktestConfig>
  >({})
  const [workbenchOpen, setWorkbenchOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('results')
  const [selectedHistoryStudyId, setSelectedHistoryStudyId] = useState<string | null>(null)

  const startOptimization = useStartOptimization()
  const cancelOptimization = useCancelOptimization()
  const statusQuery = useOptimizationStatus(studyId)
  const status = statusQuery.data

  const hasTerminalResults = status?.status === 'done' || status?.status === 'cancelled'
  const resultsQuery = useOptimizationResults(studyId, hasTerminalResults)

  const isRunning =
    startOptimization.isPending || status?.status === 'pending' || status?.status === 'running'

  useEffect(() => {
    if (isRunning || hasTerminalResults) {
      setWorkbenchOpen(false)
    }
  }, [isRunning, hasTerminalResults])

  const handleSubmit = (config: OptimizationConfig) => {
    setSubmittedConfig(config)
    setRightPanelTab('results')
    startOptimization.mutate(config, {
      onSuccess: (res) => {
        setStudyId(res.study_id)
        setStudyBacktestConfigs((prev) => ({
          ...prev,
          [res.study_id]: config.backtest,
        }))
        setWorkbenchOpen(false)
      },
    })
  }

  const handleCancel = () => {
    if (studyId) cancelOptimization.mutate(studyId)
  }

  const handleContinueStudy = (
    historyStudyId: string,
    config: OptimizationConfig,
    status: JobStatus,
  ) => {
    setSubmittedConfig(config)
    setStudyBacktestConfigs((prev) => ({
      ...prev,
      [historyStudyId]: config.backtest,
    }))

    if (status === 'pending' || status === 'running') {
      setStudyId(historyStudyId)
      setRightPanelTab('results')
      setWorkbenchOpen(false)
      return
    }

    setWorkbenchOpen(true)
    setRightPanelTab('results')
  }

  const startError = startOptimization.error
    ? axios.isAxiosError(startOptimization.error)
      ? ((startOptimization.error.response?.data as { detail?: string })?.detail ??
        startOptimization.error.message)
      : 'Failed to start optimization'
    : null

  return (
    <div className="text-silver-100 flex h-[calc(100dvh-4.5rem-7rem)] w-full overflow-hidden">
      <OptimizationWorkbench open={workbenchOpen} onOpenChange={setWorkbenchOpen}>
        <OptimizeConfigForm
          loading={startOptimization.isPending}
          error={startError}
          disabled={isRunning}
          onSubmit={handleSubmit}
        />
      </OptimizationWorkbench>

      <div className="quant-panel flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl p-4 md:p-6">
        <div className="border-carbon-600/60 mb-4 flex shrink-0 gap-1 border-b">
          {RIGHT_PANEL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRightPanelTab(tab.id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                rightPanelTab === tab.id
                  ? 'border-brass-400 text-brass-400'
                  : 'text-silver-400 hover:text-silver-200 border-transparent',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {rightPanelTab === 'history' ? (
          <OptimizationHistoryPanel
            selectedStudyId={selectedHistoryStudyId}
            onSelectStudy={setSelectedHistoryStudyId}
            studyBacktestConfigs={studyBacktestConfigs}
            onContinueStudy={handleContinueStudy}
          />
        ) : (
          <OptimizationResultsPanel
            isRunning={isRunning}
            status={status}
            results={resultsQuery.data}
            backtest={submittedConfig?.backtest ?? null}
            onCancel={handleCancel}
            cancelling={cancelOptimization.isPending}
            onOpenWorkbench={() => setWorkbenchOpen(true)}
          />
        )}
      </div>
    </div>
  )
}
