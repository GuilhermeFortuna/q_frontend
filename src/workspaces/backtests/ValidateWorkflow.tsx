import axios from 'axios'
import { useEffect } from 'react'

import {
  shouldFetchWalkForwardResults,
  useCancelWalkForward,
  useStartWalkForward,
  useWalkForwardResults,
  useWalkForwardStatus,
} from '@/api/queries/walkforward'
import { OptimizationWorkbench } from '@/components/optimize/OptimizationWorkbench'
import { WalkForwardConfigForm } from '@/components/walkforward/WalkForwardConfigForm'
import { WalkForwardHistoryPanel } from '@/components/walkforward/WalkForwardHistoryPanel'
import { WalkForwardResultsPanel } from '@/components/walkforward/WalkForwardResultsPanel'
import { useAppStore } from '@/store/useAppStore'
import type { WalkForwardRequest } from '@/types/walkforward'

export function ValidateWorkflow() {
  const { runId, submittedBacktest, workbenchOpen, rightPanelTab, selectedHistoryRunId } =
    useAppStore((s) => s.walkForwardSession)
  const patchSession = useAppStore((s) => s.patchWalkForwardSession)

  const startWalkForward = useStartWalkForward()
  const cancelWalkForward = useCancelWalkForward()
  const statusQuery = useWalkForwardStatus(runId)
  const status = statusQuery.data

  const hasTerminalResults = shouldFetchWalkForwardResults(status?.status)
  const resultsQuery = useWalkForwardResults(runId, hasTerminalResults)

  const isRunning =
    startWalkForward.isPending || status?.status === 'pending' || status?.status === 'running'

  useEffect(() => {
    if (isRunning || hasTerminalResults) {
      patchSession({ workbenchOpen: false })
    }
  }, [isRunning, hasTerminalResults, patchSession])

  const handleSubmit = (body: WalkForwardRequest) => {
    patchSession({ submittedBacktest: body.optimization.backtest, rightPanelTab: 'results' })
    startWalkForward.mutate(body, {
      onSuccess: (res) => {
        patchSession({ runId: res.run_id, workbenchOpen: false })
      },
    })
  }

  const handleCancel = () => {
    if (runId) cancelWalkForward.mutate(runId)
  }

  const startError = startWalkForward.error
    ? axios.isAxiosError(startWalkForward.error)
      ? ((startWalkForward.error.response?.data as { detail?: string })?.detail ??
        startWalkForward.error.message)
      : 'Failed to start walk-forward run'
    : null

  const backtest =
    submittedBacktest ??
    status?.backtest_config ??
    resultsQuery.data?.optimization_config?.backtest ??
    null

  if (rightPanelTab === 'history') {
    return (
      <WalkForwardHistoryPanel
        selectedRunId={selectedHistoryRunId}
        onSelectRun={(id) => patchSession({ selectedHistoryRunId: id })}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <OptimizationWorkbench
        open={workbenchOpen}
        onOpenChange={(open) => patchSession({ workbenchOpen: open })}
      >
        <WalkForwardConfigForm
          loading={startWalkForward.isPending}
          error={startError}
          disabled={isRunning}
          onSubmit={handleSubmit}
        />
      </OptimizationWorkbench>

      <WalkForwardResultsPanel
        isRunning={isRunning}
        status={status}
        results={resultsQuery.data}
        backtest={backtest}
        onCancel={handleCancel}
        cancelling={cancelWalkForward.isPending}
        onOpenWorkbench={() => patchSession({ workbenchOpen: true })}
      />
    </div>
  )
}
