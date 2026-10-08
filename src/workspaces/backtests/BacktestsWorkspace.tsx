import axios from 'axios'
import { useEffect } from 'react'

import { useBacktestJob, useBacktestRun, useStoredBacktestResult } from '@/api/queries/backtests'
import { BacktestFocusWorkbench } from '@/components/backtests/focus/BacktestFocusWorkbench'
import { BacktestHistoryPanel } from '@/components/backtests/BacktestHistoryPanel'
import { RunComparisonView } from '@/components/backtests/RunComparisonView'
import {
  StoredResultLoading,
  StoredResultNotice,
  StoredRunHeader,
} from '@/components/backtests/StoredRunPanels'
import { LazyRouteBoundary } from '@/components/islands/LazyRouteBoundary'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import { useBacktestPerformanceData } from '@/lib/backtesting/useBacktestPerformanceData'
import { cn } from '@/lib/utils'
import type { BacktestWorkflowMode, JobPanelTab } from '@/store/slices/jobSessionsSlice'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'
import { LazyOptimizeWorkflow, LazyValidateWorkflow } from '@/app/lazyWorkspaces'
import { Panel } from '@/components/ui/Panel'

const WORKFLOW_MODES: { id: BacktestWorkflowMode; label: string }[] = [
  { id: 'backtest', label: 'Simulation' },
  { id: 'optimize', label: 'Optimization' },
  { id: 'validate', label: 'Validation' },
]

const RIGHT_PANEL_TABS: { id: JobPanelTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'history', label: 'History' },
]

type BacktestsWorkspaceProps = {
  initialMode?: BacktestWorkflowMode
}

export function BacktestsWorkspace({ initialMode }: BacktestsWorkspaceProps) {
  const runBacktest = useBacktestJob()
  const backtestConfig = useBacktestConfig()
  const optimizeConfig = useOptimizeConfig()
  const reducedMotion = usePrefersReducedMotion()

  const {
    workflowMode: storedWorkflowMode,
    lastCapital,
    lastRequest,
    focus,
    rightPanelTab: backtestRightPanelTab,
    selectedHistoryRunId,
    storedRunId: openedRunId,
    comparisonRuns,
  } = useAppStore((s) => s.backtestSession)
  const storedRunId = openedRunId ?? null
  const showingStored = storedRunId !== null
  const storedRunDetail = useBacktestRun(storedRunId)
  const storedResult = useStoredBacktestResult(storedRunId)
  const storedRun = showingStored ? storedRunDetail.data : undefined
  const storedRequest = storedRun?.config ?? null
  const storedFailure = showingStored ? (storedResult.error ?? storedRunDetail.error) : null
  const storedLoading =
    showingStored && (storedResult.isPending || storedRunDetail.isPending) && !storedFailure
  const optimizeRightPanelTab = useAppStore((s) => s.optimizeSession.rightPanelTab)
  const validateRightPanelTab = useAppStore((s) => s.walkForwardSession.rightPanelTab)
  const patchBacktestSession = useAppStore((s) => s.patchBacktestSession)
  const patchOptimizeSession = useAppStore((s) => s.patchOptimizeSession)
  const patchWalkForwardSession = useAppStore((s) => s.patchWalkForwardSession)

  const workflowMode = storedWorkflowMode ?? 'backtest'

  useEffect(() => {
    if (!initialMode) return
    patchBacktestSession({ workflowMode: initialMode })
  }, [initialMode, patchBacktestSession])

  const rightPanelTab =
    workflowMode === 'optimize'
      ? optimizeRightPanelTab
      : workflowMode === 'validate'
        ? validateRightPanelTab
        : backtestRightPanelTab

  const handleRightPanelTabChange = (tab: JobPanelTab) => {
    if (workflowMode === 'optimize') {
      patchOptimizeSession({ rightPanelTab: tab })
      return
    }
    if (workflowMode === 'validate') {
      patchWalkForwardSession({ rightPanelTab: tab })
      return
    }
    patchBacktestSession({ rightPanelTab: tab })
  }

  const resultsData = showingStored ? storedResult.data : runBacktest.data
  const resultsRequest = showingStored ? storedRequest : lastRequest
  const resultsCapital = showingStored ? (storedRequest?.initial_capital ?? 100000) : lastCapital

  const {
    equityCurve,
    monthlyStats,
    computing: performanceComputing,
  } = useBacktestPerformanceData(resultsData?.trades, resultsCapital)

  const handleSubmit = (request: BacktestRequest) => {
    patchBacktestSession({
      lastCapital: request.initial_capital ?? 100000,
      lastRequest: request,
      storedRunId: null,
      focus: 'results',
      rightPanelTab: 'results',
    })
    runBacktest.mutate(request)
  }

  const handleOpenStoredRun = (runId: string) => {
    if (runBacktest.isPending) return
    patchBacktestSession({
      storedRunId: runId,
      focus: 'results',
      rightPanelTab: 'results',
    })
  }

  const errorMessage = runBacktest.error
    ? axios.isAxiosError(runBacktest.error)
      ? ((runBacktest.error.response?.data as { detail?: string })?.detail ??
        runBacktest.error.message)
      : runBacktest.error instanceof Error
        ? runBacktest.error.message
        : 'Failed to run backtest'
    : null

  return (
    <div
      className="text-silver-100 flex min-h-[calc(100dvh-4.5rem-7rem)] w-full flex-col overflow-hidden"
      data-workspace-transition-root="backtests"
    >
      <h1 className="sr-only" data-workspace-transition-anchor="backtests">
        Backtests
      </h1>
      <Panel
        className="flex flex-1 flex-col overflow-hidden rounded-xl px-5 py-4"
        data-workspace-transition-surface="primary"
      >
        <div
          className="border-carbon-600/60 mb-4 flex shrink-0 gap-1 border-b"
          data-workspace-transition-surface="secondary"
        >
          {WORKFLOW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => patchBacktestSession({ workflowMode: mode.id })}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                workflowMode === mode.id
                  ? 'border-brass-400 text-brass-400'
                  : 'text-silver-400 hover:text-silver-200 border-transparent',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="border-carbon-600/60 mb-4 flex shrink-0 gap-1 border-b">
          {RIGHT_PANEL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleRightPanelTabChange(tab.id)}
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

        {workflowMode === 'optimize' ? (
          <div
            data-testid="optimize-workflow"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <LazyRouteBoundary label="Loading optimization">
              <LazyOptimizeWorkflow config={optimizeConfig} />
            </LazyRouteBoundary>
          </div>
        ) : null}

        {workflowMode === 'validate' ? (
          <div
            data-testid="validate-workflow"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <LazyRouteBoundary label="Loading validation">
              <LazyValidateWorkflow />
            </LazyRouteBoundary>
          </div>
        ) : null}

        {workflowMode === 'backtest' ? (
          <div
            data-testid="backtest-workflow"
            data-workspace-transition-surface="tertiary"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {backtestRightPanelTab === 'history' ? (
              comparisonRuns ? (
                <RunComparisonView
                  runs={comparisonRuns}
                  onClose={() => patchBacktestSession({ comparisonRuns: null })}
                />
              ) : (
                <BacktestHistoryPanel
                  selectedRunId={selectedHistoryRunId}
                  onSelectRun={(id) => patchBacktestSession({ selectedHistoryRunId: id })}
                  onReRun={handleSubmit}
                  onOpenResults={handleOpenStoredRun}
                  simulationPending={runBacktest.isPending}
                  onCompare={(runs) => patchBacktestSession({ comparisonRuns: runs })}
                />
              )
            ) : (
              <>
                {storedRun ? (
                  <StoredRunHeader
                    run={storedRun}
                    onBackToHistory={() => patchBacktestSession({ rightPanelTab: 'history' })}
                  />
                ) : null}
                {showingStored && storedFailure ? (
                  <StoredResultNotice
                    run={storedRun}
                    error={storedFailure}
                    onReRun={storedRequest ? () => handleSubmit(storedRequest) : undefined}
                  />
                ) : storedLoading ? (
                  <StoredResultLoading />
                ) : (
                  <BacktestFocusWorkbench
                    focus={focus}
                    onFocusChange={(f) => patchBacktestSession({ focus: f })}
                    onOpenHistory={() => patchBacktestSession({ rightPanelTab: 'history' })}
                    reducedMotion={reducedMotion}
                    config={backtestConfig}
                    loading={runBacktest.isPending}
                    error={errorMessage}
                    onSubmit={handleSubmit}
                    results={resultsData}
                    lastRequest={resultsRequest}
                    initialCapital={resultsCapital}
                    equityCurve={equityCurve}
                    monthlyStats={monthlyStats}
                    performanceComputing={performanceComputing}
                    allowMlFilterTraining={storedRun?.origin !== 'script'}
                  />
                )}
              </>
            )}
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
