import axios from 'axios'
import { useEffect, useMemo } from 'react'

import { useBacktestJob } from '@/api/queries/backtests'
import { BacktestFocusWorkbench } from '@/components/backtests/focus/BacktestFocusWorkbench'
import { BacktestHistoryPanel } from '@/components/backtests/BacktestHistoryPanel'
import { RunComparisonView } from '@/components/backtests/RunComparisonView'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { aggregateMonthlyStats, buildEquityCurve } from '@/lib/backtesting/performance'
import { cn } from '@/lib/utils'
import type { BacktestWorkflowMode, JobPanelTab } from '@/store/slices/jobSessionsSlice'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'
import { OptimizeWorkflow } from '@/workspaces/backtests/OptimizeWorkflow'

const WORKFLOW_MODES: { id: BacktestWorkflowMode; label: string }[] = [
  { id: 'backtest', label: 'Simulation' },
  { id: 'optimize', label: 'Optimization' },
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
  const reducedMotion = usePrefersReducedMotion()

  const {
    workflowMode: storedWorkflowMode,
    lastCapital,
    lastRequest,
    focus,
    rightPanelTab: backtestRightPanelTab,
    selectedHistoryRunId,
    comparisonRuns,
  } = useAppStore((s) => s.backtestSession)
  const optimizeRightPanelTab = useAppStore((s) => s.optimizeSession.rightPanelTab)
  const patchBacktestSession = useAppStore((s) => s.patchBacktestSession)
  const patchOptimizeSession = useAppStore((s) => s.patchOptimizeSession)

  const workflowMode = storedWorkflowMode ?? 'backtest'

  useEffect(() => {
    if (!initialMode) return
    patchBacktestSession({ workflowMode: initialMode })
  }, [initialMode, patchBacktestSession])

  const rightPanelTab = workflowMode === 'optimize' ? optimizeRightPanelTab : backtestRightPanelTab

  const handleRightPanelTabChange = (tab: JobPanelTab) => {
    if (workflowMode === 'optimize') {
      patchOptimizeSession({ rightPanelTab: tab })
      return
    }
    patchBacktestSession({ rightPanelTab: tab })
  }

  const equityCurve = useMemo(() => {
    if (!runBacktest.data) return []
    return buildEquityCurve(runBacktest.data.trades, lastCapital)
  }, [runBacktest.data, lastCapital])

  const monthlyStats = useMemo(() => {
    if (!runBacktest.data) return []
    return aggregateMonthlyStats(runBacktest.data.trades)
  }, [runBacktest.data])

  const handleSubmit = (request: BacktestRequest) => {
    patchBacktestSession({
      lastCapital: request.initial_capital ?? 100000,
      lastRequest: request,
      focus: 'results',
      rightPanelTab: 'results',
    })
    runBacktest.mutate(request)
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
    <div className="text-silver-100 flex min-h-[calc(100dvh-4.5rem-7rem)] w-full flex-col overflow-hidden">
      <div className="quant-panel flex flex-1 flex-col overflow-hidden rounded-xl px-5 py-4">
        <div className="border-carbon-600/60 mb-4 flex shrink-0 gap-1 border-b">
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

        <div
          data-testid="optimize-workflow"
          style={{ display: workflowMode === 'optimize' ? undefined : 'none' }}
        >
          <OptimizeWorkflow />
        </div>

        <div
          data-testid="backtest-workflow"
          style={{ display: workflowMode === 'backtest' ? undefined : 'none' }}
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
                onCompare={(runs) => patchBacktestSession({ comparisonRuns: runs })}
              />
            )
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
              results={runBacktest.data}
              lastRequest={lastRequest}
              initialCapital={lastCapital}
              equityCurve={equityCurve}
              monthlyStats={monthlyStats}
            />
          )}
        </div>
      </div>
    </div>
  )
}
