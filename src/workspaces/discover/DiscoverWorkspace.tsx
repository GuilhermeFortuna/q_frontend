import axios from 'axios'
import { useEffect, useLayoutEffect, useRef } from 'react'

import {
  shouldFetchStrategySearchResults,
  useCancelStrategySearch,
  useStartStrategySearch,
  useStrategySearchResults,
  useStrategySearchStatus,
} from '@/api/queries/strategySearch'
import { DiscoverConfigForm } from '@/components/discover/DiscoverConfigForm'
import { DiscoverHistoryPanel } from '@/components/discover/DiscoverHistoryPanel'
import { DiscoverResultsPanel } from '@/components/discover/DiscoverResultsPanel'
import { OptimizationWorkbench } from '@/components/optimize/OptimizationWorkbench'
import { Panel } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { useAppStore } from '@/store/useAppStore'
import type { JobPanelTab } from '@/store/slices/jobSessionsSlice'
import type { StrategySearchConfig } from '@/types/strategySearch'

const RIGHT_PANEL_TABS: { id: JobPanelTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'history', label: 'History' },
]

export function DiscoverWorkspace() {
  const { runId, submittedBacktest, workbenchOpen, rightPanelTab, selectedHistoryRunId } =
    useAppStore((s) => s.discoverSession)
  const patchSession = useAppStore((s) => s.patchDiscoverSession)
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const rail = rootRef.current?.querySelector<HTMLElement>('.relative.z-20.flex.h-full.shrink-0')
    rail?.setAttribute('data-workspace-transition-surface', 'secondary')
  }, [])

  const startSearch = useStartStrategySearch()
  const cancelSearch = useCancelStrategySearch()
  const statusQuery = useStrategySearchStatus(runId)
  const status = statusQuery.data

  const hasTerminalResults = shouldFetchStrategySearchResults(status?.status)
  const resultsQuery = useStrategySearchResults(runId, hasTerminalResults)

  const isRunning =
    startSearch.isPending || status?.status === 'pending' || status?.status === 'running'

  useEffect(() => {
    if (isRunning || hasTerminalResults) {
      patchSession({ workbenchOpen: false })
    }
  }, [isRunning, hasTerminalResults, patchSession])

  const handleSubmit = (body: StrategySearchConfig) => {
    patchSession({ submittedBacktest: body.backtest, rightPanelTab: 'results' })
    startSearch.mutate(body, {
      onSuccess: (res) => {
        patchSession({ runId: res.run_id, workbenchOpen: false })
      },
    })
  }

  const handleCancel = () => {
    if (runId) cancelSearch.mutate(runId)
  }

  const startError = startSearch.error
    ? axios.isAxiosError(startSearch.error)
      ? ((startSearch.error.response?.data as { detail?: string })?.detail ??
        startSearch.error.message)
      : 'Failed to start strategy search'
    : null

  const backtest =
    submittedBacktest ??
    status?.backtest_config ??
    resultsQuery.data?.search_config?.backtest ??
    null

  return (
    <div
      ref={rootRef}
      className="text-silver-100 flex h-[calc(100dvh-4.5rem-7rem)] w-full overflow-hidden"
      data-workspace-transition-root="discover"
    >
      <h1 className="sr-only" data-workspace-transition-anchor="discover">
        Discover
      </h1>
      <OptimizationWorkbench
        open={workbenchOpen}
        onOpenChange={(open) => patchSession({ workbenchOpen: open })}
      >
        <DiscoverConfigForm
          loading={startSearch.isPending}
          error={startError}
          disabled={isRunning}
          onSubmit={handleSubmit}
        />
      </OptimizationWorkbench>

      <Panel
        living
        className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl p-4 md:p-6"
        data-workspace-transition-surface="primary"
      >
        <SegmentedToggle
          aria-label="Discover panel"
          className="mb-4 shrink-0 self-start"
          value={rightPanelTab}
          onChange={(tab) => patchSession({ rightPanelTab: tab })}
          options={RIGHT_PANEL_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
        />

        {rightPanelTab === 'history' ? (
          <DiscoverHistoryPanel
            selectedRunId={selectedHistoryRunId}
            onSelectRun={(id) => patchSession({ selectedHistoryRunId: id })}
          />
        ) : (
          <DiscoverResultsPanel
            runId={runId}
            isRunning={isRunning}
            status={status}
            results={resultsQuery.data}
            backtest={backtest}
            onCancel={handleCancel}
            cancelling={cancelSearch.isPending}
            onOpenWorkbench={() => patchSession({ workbenchOpen: true })}
          />
        )}
      </Panel>
    </div>
  )
}
