import axios from 'axios'
import { useEffect, useState } from 'react'

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
import { cn } from '@/lib/utils'
import type { OptimizationBacktestConfig } from '@/types/optimization'
import type { StrategySearchConfig } from '@/types/strategySearch'

type RightPanelTab = 'results' | 'history'

const RIGHT_PANEL_TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'history', label: 'History' },
]

export function DiscoverWorkspace() {
  const [runId, setRunId] = useState<string | null>(null)
  const [submittedBacktest, setSubmittedBacktest] = useState<OptimizationBacktestConfig | null>(
    null,
  )
  const [workbenchOpen, setWorkbenchOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('results')
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null)

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
      setWorkbenchOpen(false)
    }
  }, [isRunning, hasTerminalResults])

  const handleSubmit = (body: StrategySearchConfig) => {
    setSubmittedBacktest(body.backtest)
    setRightPanelTab('results')
    startSearch.mutate(body, {
      onSuccess: (res) => {
        setRunId(res.run_id)
        setWorkbenchOpen(false)
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
    <div className="text-silver-100 flex h-[calc(100dvh-4.5rem-7rem)] w-full overflow-hidden">
      <OptimizationWorkbench open={workbenchOpen} onOpenChange={setWorkbenchOpen}>
        <DiscoverConfigForm
          loading={startSearch.isPending}
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
          <DiscoverHistoryPanel
            selectedRunId={selectedHistoryRunId}
            onSelectRun={setSelectedHistoryRunId}
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
            onOpenWorkbench={() => setWorkbenchOpen(true)}
          />
        )}
      </div>
    </div>
  )
}
