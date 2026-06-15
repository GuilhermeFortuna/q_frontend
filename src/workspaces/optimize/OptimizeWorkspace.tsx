import axios from 'axios'

import {
  useCancelOptimization,
  useOptimizationResults,
  useOptimizationStatus,
  useStartOptimization,
} from '@/api/queries/optimize'
import { OptimizeFocusWorkbench } from '@/components/optimize/focus/OptimizeFocusWorkbench'
import { OptimizationHistoryPanel } from '@/components/optimize/OptimizationHistoryPanel'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { JobPanelTab } from '@/store/slices/jobSessionsSlice'
import type { JobStatus, OptimizationConfig } from '@/types/optimization'

const RIGHT_PANEL_TABS: { id: JobPanelTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'history', label: 'History' },
]

export function OptimizeWorkspace() {
  const optimizeConfig = useOptimizeConfig()
  const reducedMotion = usePrefersReducedMotion()

  const {
    studyId,
    submittedConfig,
    studyBacktestConfigs,
    focus,
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

  const handleSubmit = (config: OptimizationConfig) => {
    patchSession({
      submittedConfig: config,
      focus: 'results',
      rightPanelTab: 'results',
    })
    startOptimization.mutate(config, {
      onSuccess: (res) => {
        patchSession({
          studyId: res.study_id,
          studyBacktestConfigs: {
            ...studyBacktestConfigs,
            [res.study_id]: config.backtest,
          },
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
    studyStatus: JobStatus,
  ) => {
    const studyBacktestConfigsNext = {
      ...studyBacktestConfigs,
      [historyStudyId]: config.backtest,
    }

    if (studyStatus === 'pending' || studyStatus === 'running') {
      patchSession({
        submittedConfig: config,
        studyBacktestConfigs: studyBacktestConfigsNext,
        studyId: historyStudyId,
        focus: 'results',
        rightPanelTab: 'results',
      })
      return
    }

    patchSession({
      submittedConfig: config,
      studyBacktestConfigs: studyBacktestConfigsNext,
      focus: 'setup',
      rightPanelTab: 'results',
    })
  }

  const formatApiError = (error: unknown, fallback: string) =>
    axios.isAxiosError(error)
      ? ((error.response?.data as { detail?: string })?.detail ?? error.message)
      : fallback

  const startError = startOptimization.error
    ? formatApiError(startOptimization.error, 'Failed to start optimization')
    : null

  const cancelError = cancelOptimization.error
    ? formatApiError(cancelOptimization.error, 'Failed to cancel optimization')
    : null

  return (
    <div className="text-silver-100 flex min-h-[calc(100dvh-4.5rem-7rem)] w-full flex-col overflow-hidden">
      <div className="quant-panel flex flex-1 flex-col overflow-hidden rounded-xl px-5 py-4">
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
          <OptimizeFocusWorkbench
            focus={focus}
            onFocusChange={(next) => patchSession({ focus: next })}
            onOpenHistory={() => patchSession({ rightPanelTab: 'history' })}
            reducedMotion={reducedMotion}
            config={optimizeConfig}
            loading={startOptimization.isPending}
            error={startError}
            disabled={isRunning}
            onSubmit={handleSubmit}
            isRunning={isRunning}
            status={status}
            results={resultsQuery.data}
            backtest={submittedConfig?.backtest ?? null}
            onCancel={handleCancel}
            cancelling={cancelOptimization.isPending}
            cancelError={cancelError}
          />
        )}
      </div>
    </div>
  )
}
