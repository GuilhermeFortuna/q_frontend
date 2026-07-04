import { useCallback, useMemo, useRef } from 'react'

import { CollapsedResultsTeaser } from '@/components/backtests/focus/CollapsedResultsTeaser'
import { CollapsedSetupTeaser } from '@/components/backtests/focus/CollapsedSetupTeaser'
import { BacktestSetupPanel } from '@/components/backtests/setup/BacktestSetupPanel'
import { BacktestResultsTabs } from '@/components/backtests/BacktestResultsTabs'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type {
  BacktestRequest,
  BacktestResponse,
  EquityPoint,
  MonthlyStats,
} from '@/types/backtesting'

export type BacktestWorkbenchFocus = 'setup' | 'results'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type BacktestFocusWorkbenchProps = {
  focus: BacktestWorkbenchFocus
  onFocusChange: (focus: BacktestWorkbenchFocus) => void
  onOpenHistory: () => void
  reducedMotion: boolean
  config: BacktestConfig
  loading: boolean
  error: string | null
  onSubmit: (request: BacktestRequest) => void
  results: BacktestResponse | undefined
  lastRequest: BacktestRequest | null
  initialCapital: number
  equityCurve: EquityPoint[]
  monthlyStats: MonthlyStats[]
  performanceComputing?: boolean
  aiWorkflowBlocker?: string | null
}

/**
 * Focus invariant: exactly one pane is visually expanded. Inactive panes are
 * parked (unmounted) while setup fields remain in the parent config hook and
 * results stay in React Query / session store.
 */
export function BacktestFocusWorkbench({
  focus,
  onFocusChange,
  onOpenHistory,
  reducedMotion,
  config,
  loading,
  error,
  onSubmit,
  results,
  lastRequest,
  initialCapital,
  equityCurve,
  monthlyStats,
  performanceComputing = false,
  aiWorkflowBlocker = null,
}: BacktestFocusWorkbenchProps) {
  const workbenchRef = useRef<HTMLDivElement>(null)
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)

  const parkSetupDraft = useCallback(() => {
    if (config.validation.formInvalid) return
    setPendingBacktestConfig(config.buildRequest())
  }, [config, setPendingBacktestConfig])

  const handleFocusChange = useCallback(
    (next: BacktestWorkbenchFocus) => {
      if (next === focus) return
      if (focus === 'setup' && next === 'results') {
        parkSetupDraft()
      }
      onFocusChange(next)
    },
    [focus, onFocusChange, parkSetupDraft],
  )

  const handleRunFromTeaser = useCallback(() => {
    if (config.validation.formInvalid || config.strategiesLoading || loading) return
    if (aiWorkflowBlocker) return
    onSubmit(config.buildRequest())
  }, [aiWorkflowBlocker, config, loading, onSubmit])

  const setupExpanded = focus === 'setup'
  const resultsExpanded = focus === 'results'
  const hasResults = Boolean(results)
  const showResultsContent = hasResults && lastRequest

  const resultsSymbol = useMemo(
    () => lastRequest?.symbol ?? results?.trades[0]?.symbol ?? '—',
    [lastRequest, results?.trades],
  )

  const resultsTimeframe = useMemo(() => lastRequest?.timeframe ?? 'D1', [lastRequest?.timeframe])

  return (
    <div
      ref={workbenchRef}
      className={cn(
        'focus-workbench grid min-h-0 flex-1 gap-2',
        reducedMotion && 'focus-workbench--reduce-motion',
      )}
      data-focus={focus}
    >
      <section className="flex min-h-0 flex-col overflow-hidden" aria-expanded={setupExpanded}>
        {setupExpanded ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <BacktestSetupPanel
              config={config}
              loading={loading}
              error={error}
              onSubmit={onSubmit}
              aiWorkflowBlocker={aiWorkflowBlocker}
            />
          </div>
        ) : (
          <CollapsedSetupTeaser
            fields={config.fields}
            strategyInfo={config.selectedStrategy}
            loading={loading}
            formInvalid={config.validation.formInvalid}
            strategiesLoading={config.strategiesLoading}
            onExpand={() => handleFocusChange('setup')}
            onRun={handleRunFromTeaser}
          />
        )}
      </section>

      <section
        className="relative flex min-h-0 flex-col overflow-hidden"
        aria-expanded={resultsExpanded}
      >
        {resultsExpanded ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex animate-pulse flex-col items-center">
                  <div className="border-brass-500 mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
                  <p className="text-silver-400">Simulating strategy over historical data...</p>
                </div>
              </div>
            ) : showResultsContent ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <BacktestResultsTabs
                  results={results!}
                  request={lastRequest}
                  initialCapital={initialCapital}
                  equityCurve={equityCurve}
                  monthlyStats={monthlyStats}
                  performanceComputing={performanceComputing}
                  symbol={resultsSymbol}
                  timeframe={resultsTimeframe}
                />
              </div>
            ) : (
              <div className="border-carbon-600/60 flex flex-1 items-center justify-center rounded-xl border-2 border-dashed">
                <p className="text-silver-400 text-sm">Run a simulation to see results here.</p>
              </div>
            )}
          </div>
        ) : (
          <CollapsedResultsTeaser
            isPending={loading}
            hasResults={hasResults}
            metrics={results?.metrics}
            equityCurve={equityCurve}
            onExpand={() => handleFocusChange('results')}
            onOpenHistory={onOpenHistory}
          />
        )}
      </section>
    </div>
  )
}
