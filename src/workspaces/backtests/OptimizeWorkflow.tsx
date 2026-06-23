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
import type { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import { useAppStore } from '@/store/useAppStore'
import type { JobStatus, OptimizationConfig } from '@/types/optimization'

type OptimizeConfig = ReturnType<typeof useOptimizeConfig>

type OptimizeWorkflowProps = {
  config: OptimizeConfig
}

export function OptimizeWorkflow({ config: optimizeConfig }: OptimizeWorkflowProps) {
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

  if (rightPanelTab === 'history') {
    return (
      <OptimizationHistoryPanel
        selectedStudyId={selectedHistoryStudyId}
        onSelectStudy={(id) => patchSession({ selectedHistoryStudyId: id })}
        studyBacktestConfigs={studyBacktestConfigs}
        onContinueStudy={handleContinueStudy}
      />
    )
  }

  return (
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
  )
}
