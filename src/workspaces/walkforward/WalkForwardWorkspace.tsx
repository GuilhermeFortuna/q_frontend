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
import { Panel } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { useAppStore } from '@/store/useAppStore'
import type { JobPanelTab } from '@/store/slices/jobSessionsSlice'
import type { WalkForwardRequest } from '@/types/walkforward'

const RIGHT_PANEL_TABS: { id: JobPanelTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'history', label: 'History' },
]

export function WalkForwardWorkspace() {
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

  return (
    <div className="text-silver-100 flex h-[calc(100dvh-4.5rem-7rem)] w-full overflow-hidden">
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

      <Panel living className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl p-4 md:p-6">
        <SegmentedToggle
          aria-label="Validate panel"
          className="mb-4 shrink-0"
          value={rightPanelTab}
          onChange={(tab) => patchSession({ rightPanelTab: tab })}
          options={RIGHT_PANEL_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
        />

        {rightPanelTab === 'history' ? (
          <WalkForwardHistoryPanel
            selectedRunId={selectedHistoryRunId}
            onSelectRun={(id) => patchSession({ selectedHistoryRunId: id })}
          />
        ) : (
          <WalkForwardResultsPanel
            isRunning={isRunning}
            status={status}
            results={resultsQuery.data}
            backtest={backtest}
            onCancel={handleCancel}
            cancelling={cancelWalkForward.isPending}
            onOpenWorkbench={() => patchSession({ workbenchOpen: true })}
          />
        )}
      </Panel>
    </div>
  )
}
