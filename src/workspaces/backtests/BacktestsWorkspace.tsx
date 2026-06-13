import axios from 'axios'
import { useMemo, useState } from 'react'

import { useBacktestJob } from '@/api/queries/backtests'
import {
  BacktestFocusWorkbench,
  type BacktestWorkbenchFocus,
} from '@/components/backtests/focus/BacktestFocusWorkbench'
import { BacktestHistoryPanel } from '@/components/backtests/BacktestHistoryPanel'
import { RunComparisonView } from '@/components/backtests/RunComparisonView'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { aggregateMonthlyStats, buildEquityCurve } from '@/lib/backtesting/performance'
import { cn } from '@/lib/utils'
import type { BacktestRequest, BacktestRunSummary } from '@/types/backtesting'

type RightPanelTab = 'results' | 'history'

const RIGHT_PANEL_TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'history', label: 'History' },
]

export function BacktestsWorkspace() {
  const runBacktest = useBacktestJob()
  const backtestConfig = useBacktestConfig()
  const reducedMotion = usePrefersReducedMotion()
  const [lastCapital, setLastCapital] = useState(100000)
  const [lastRequest, setLastRequest] = useState<BacktestRequest | null>(null)
  const [focus, setFocus] = useState<BacktestWorkbenchFocus>('setup')
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('results')
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
    setFocus('results')
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

  return (
    <div className="text-silver-100 flex min-h-[calc(100dvh-4.5rem-7rem)] w-full flex-col overflow-hidden">
      <div className="quant-panel flex flex-1 flex-col overflow-hidden rounded-xl px-5 py-4">
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
          <BacktestFocusWorkbench
            focus={focus}
            onFocusChange={setFocus}
            onOpenHistory={() => setRightPanelTab('history')}
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
  )
}
