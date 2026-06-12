import axios from 'axios'
import { useMemo, useState } from 'react'

import { useRunBacktest } from '@/api/queries/backtests'
import { BacktestConfigSummaryStrip } from '@/components/backtests/setup/BacktestConfigSummaryStrip'
import { BacktestSetupPanel } from '@/components/backtests/setup/BacktestSetupPanel'
import { BacktestHistoryPanel } from '@/components/backtests/BacktestHistoryPanel'
import { BacktestResultsTabs } from '@/components/backtests/BacktestResultsTabs'
import { RunComparisonView } from '@/components/backtests/RunComparisonView'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { aggregateMonthlyStats, buildEquityCurve } from '@/lib/backtesting/performance'
import { cn } from '@/lib/utils'
import type { BacktestRequest, BacktestRunSummary } from '@/types/backtesting'

type RightPanelTab = 'results' | 'history'
type CanvasView = 'setup' | 'results'

const RIGHT_PANEL_TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'history', label: 'History' },
]

export function BacktestsWorkspace() {
  const runBacktest = useRunBacktest()
  const backtestConfig = useBacktestConfig()
  const [lastCapital, setLastCapital] = useState(100000)
  const [lastRequest, setLastRequest] = useState<BacktestRequest | null>(null)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('results')
  const [canvasView, setCanvasView] = useState<CanvasView>('setup')
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null)
  const [comparisonRuns, setComparisonRuns] = useState<BacktestRunSummary[] | null>(null)

  const equityCurve = useMemo(() => {
    if (!runBacktest.data) return []
    return buildEquityCurve(runBacktest.data.trades, lastCapital)
  }, [runBacktest.data, lastCapital])

  const monthlyStats = useMemo(() => {
    if (!runBacktest.data) return []
    return aggregateMonthlyStats(runBacktest.data.trades)
  }, [runBacktest.data])

  const handleSubmit = (request: BacktestRequest) => {
    setLastCapital(request.initial_capital ?? 100000)
    setLastRequest(request)
    setCanvasView('results')
    setRightPanelTab('results')
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

  const hasResults = Boolean(runBacktest.data)
  const showResultsPane =
    rightPanelTab === 'results' &&
    (runBacktest.isPending || (hasResults && canvasView === 'results'))
  const showSetupPane =
    rightPanelTab === 'results' && !runBacktest.isPending && canvasView === 'setup'

  const submittedStrategyInfo = useMemo(() => {
    if (!lastRequest?.strategy) return undefined
    return backtestConfig.strategies.find((entry) => entry.name === lastRequest.strategy)
  }, [backtestConfig.strategies, lastRequest?.strategy])

  return (
    <div className="text-silver-100 flex min-h-[calc(100dvh-4.5rem-7rem)] w-full flex-col overflow-hidden">
      <div className="quant-panel flex flex-1 flex-col overflow-hidden rounded-xl px-5 py-4">
        <div className="border-carbon-600/60 mb-4 flex shrink-0 gap-1 border-b">
          {RIGHT_PANEL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setRightPanelTab(tab.id)
                if (tab.id === 'results' && runBacktest.data) {
                  setCanvasView('results')
                }
              }}
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
          comparisonRuns ? (
            <RunComparisonView runs={comparisonRuns} onClose={() => setComparisonRuns(null)} />
          ) : (
            <BacktestHistoryPanel
              selectedRunId={selectedHistoryRunId}
              onSelectRun={setSelectedHistoryRunId}
              onReRun={handleSubmit}
              onCompare={setComparisonRuns}
            />
          )
        ) : (
          <div className="relative min-h-0 flex-1">
            {/* Setup pane — kept mounted so config state survives Edit setup round trips (WO29 sibling panes). */}
            <div
              className={cn(
                'absolute inset-0 flex flex-col overflow-hidden',
                showSetupPane ? 'visible z-10' : 'pointer-events-none invisible z-0',
              )}
              aria-hidden={!showSetupPane}
            >
              <BacktestSetupPanel
                config={backtestConfig}
                loading={runBacktest.isPending}
                error={showSetupPane ? errorMessage : null}
                onSubmit={handleSubmit}
              />
            </div>

            {/* Results pane — sibling to setup for WO29 focus-swap animation. */}
            <div
              className={cn(
                'absolute inset-0 flex flex-col overflow-hidden',
                showResultsPane ? 'visible z-10' : 'pointer-events-none invisible z-0',
              )}
              aria-hidden={!showResultsPane}
            >
              {runBacktest.isPending ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex animate-pulse flex-col items-center">
                    <div className="border-brass-500 mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
                    <p className="text-silver-400">Simulating strategy over historical data...</p>
                  </div>
                </div>
              ) : hasResults && lastRequest ? (
                <>
                  <BacktestConfigSummaryStrip
                    request={lastRequest}
                    strategyInfo={submittedStrategyInfo}
                    onEditSetup={() => setCanvasView('setup')}
                  />
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <BacktestResultsTabs
                      results={runBacktest.data!}
                      request={lastRequest}
                      initialCapital={lastCapital}
                      equityCurve={equityCurve}
                      monthlyStats={monthlyStats}
                      symbol={lastRequest.symbol ?? runBacktest.data!.trades[0]?.symbol ?? '—'}
                      timeframe={lastRequest.timeframe ?? 'D1'}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
