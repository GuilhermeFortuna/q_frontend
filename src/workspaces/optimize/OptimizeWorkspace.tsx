import axios from 'axios'
import { useEffect } from 'react'

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
import { useAppStore } from '@/store/useAppStore'
import type { JobPanelTab } from '@/store/slices/jobSessionsSlice'
import type { JobStatus, OptimizationConfig } from '@/types/optimization'

const RIGHT_PANEL_TABS: { id: JobPanelTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'history', label: 'History' },
]

export function OptimizeWorkspace() {
  const {
    studyId,
    submittedConfig,
    studyBacktestConfigs,
    workbenchOpen,
    rightPanelTab,
    selectedHistoryStudyId,
  } = useAppStore((s) => s.optimizeSession)
  const patchSession = useAppStore((s) => s.patchOptimizeSession)

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
      patchSession({ workbenchOpen: false })
    }
  }, [isRunning, hasTerminalResults, patchSession])

  const handleSubmit = (config: OptimizationConfig) => {
    patchSession({ submittedConfig: config, rightPanelTab: 'results' })
    startOptimization.mutate(config, {
      onSuccess: (res) => {
        patchSession({
          studyId: res.study_id,
          studyBacktestConfigs: {
            ...studyBacktestConfigs,
            [res.study_id]: config.backtest,
          },
          workbenchOpen: false,
        })
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
    const studyBacktestConfigsNext = {
      ...studyBacktestConfigs,
      [historyStudyId]: config.backtest,
    }

    if (status === 'pending' || status === 'running') {
      patchSession({
        submittedConfig: config,
        studyBacktestConfigs: studyBacktestConfigsNext,
        studyId: historyStudyId,
        rightPanelTab: 'results',
        workbenchOpen: false,
      })
      return
    }

    patchSession({
      submittedConfig: config,
      studyBacktestConfigs: studyBacktestConfigsNext,
      workbenchOpen: true,
      rightPanelTab: 'results',
    })
  }

  const startError = startOptimization.error
    ? axios.isAxiosError(startOptimization.error)
      ? ((startOptimization.error.response?.data as { detail?: string })?.detail ??
        startOptimization.error.message)
      : 'Failed to start optimization'
    : null

  return (
    <div className="text-silver-100 flex h-[calc(100dvh-4.5rem-7rem)] w-full overflow-hidden">
      <OptimizationWorkbench
        open={workbenchOpen}
        onOpenChange={(open) => patchSession({ workbenchOpen: open })}
      >
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
              onClick={() => patchSession({ rightPanelTab: tab.id })}
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
            onSelectStudy={(id) => patchSession({ selectedHistoryStudyId: id })}
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
            onOpenWorkbench={() => patchSession({ workbenchOpen: true })}
          />
        )}
      </div>
    </div>
  )
}
