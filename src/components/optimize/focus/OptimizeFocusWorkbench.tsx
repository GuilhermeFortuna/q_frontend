import { useCallback, useMemo, useRef, useState } from 'react'

import { CollapsedOptimizeResultsTeaser } from '@/components/optimize/focus/CollapsedOptimizeResultsTeaser'
import { CollapsedOptimizeSetupTeaser } from '@/components/optimize/focus/CollapsedOptimizeSetupTeaser'
import { OptimizationProgress } from '@/components/optimize/OptimizationProgress'
import { OptimizationResultsTabs } from '@/components/optimize/OptimizationResultsTabs'
import { OptimizeSetupPanel } from '@/components/optimize/setup/OptimizeSetupPanel'
import type { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import { cn } from '@/lib/utils'
import type { BacktestWorkbenchFocus } from '@/store/slices/jobSessionsSlice'
import type {
  OptimizationBacktestConfig,
  OptimizationConfig,
  OptimizationResults,
  OptimizationStatus,
} from '@/types/optimization'

type OptimizeConfig = ReturnType<typeof useOptimizeConfig>

type OptimizeFocusWorkbenchProps = {
  focus: BacktestWorkbenchFocus
  onFocusChange: (focus: BacktestWorkbenchFocus) => void
  onOpenHistory: () => void
  reducedMotion: boolean
  config: OptimizeConfig
  loading: boolean
  error: string | null
  disabled: boolean
  onSubmit: (config: OptimizationConfig) => void
  isRunning: boolean
  status: OptimizationStatus | undefined
  results: OptimizationResults | undefined
  backtest: OptimizationBacktestConfig | null
  onCancel: () => void
  cancelling: boolean
  cancelError: string | null
}

/**
 * Focus invariant: exactly one pane is visually expanded; setup and results stay
 * mounted at all times so form state, polling data, and in-pane scroll survive swaps.
 */
export function OptimizeFocusWorkbench({
  focus,
  onFocusChange,
  onOpenHistory,
  reducedMotion,
  config,
  loading,
  error,
  disabled,
  onSubmit,
  isRunning,
  status,
  results,
  backtest,
  onCancel,
  cancelling,
  cancelError,
}: OptimizeFocusWorkbenchProps) {
  const workbenchRef = useRef<HTMLDivElement>(null)
  const [chartsReady, setChartsReady] = useState(true)

  const handleTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'grid-template-rows') return
    if (event.currentTarget !== event.target) return
    setChartsReady(true)
    window.dispatchEvent(new Event('resize'))
  }, [])

  const handleFocusChange = useCallback(
    (next: BacktestWorkbenchFocus) => {
      if (next === focus) return
      if (!reducedMotion) {
        setChartsReady(false)
      }
      onFocusChange(next)
    },
    [focus, onFocusChange, reducedMotion],
  )

  const handleRunFromTeaser = useCallback(() => {
    if (config.validation.formInvalid || config.strategiesLoading || loading || disabled) return
    if (!config.selectedStrategy) return
    onSubmit(config.buildOptimizationConfig())
  }, [config, disabled, loading, onSubmit])

  const setupExpanded = focus === 'setup'
  const resultsExpanded = focus === 'results'
  const hasResults = Boolean(results && backtest)

  const statusLabel = useMemo(
    () =>
      status?.status === 'cancelled' ? 'Study cancelled — showing partial results' : undefined,
    [status?.status],
  )

  return (
    <div
      ref={workbenchRef}
      className={cn(
        'focus-workbench grid min-h-0 flex-1 gap-2',
        reducedMotion && 'focus-workbench--reduce-motion',
      )}
      data-focus={focus}
      onTransitionEnd={handleTransitionEnd}
    >
      <section className="flex min-h-0 flex-col overflow-hidden" aria-expanded={setupExpanded}>
        <div
          className={cn(
            'flex min-h-0 flex-col overflow-hidden',
            setupExpanded ? 'flex-1' : 'hidden',
          )}
          aria-hidden={!setupExpanded}
        >
          <OptimizeSetupPanel
            config={config}
            loading={loading}
            error={error}
            disabled={disabled}
            onSubmit={onSubmit}
          />
        </div>
        {!setupExpanded ? (
          <CollapsedOptimizeSetupTeaser
            fields={config.fields}
            strategyInfo={config.selectedStrategy}
            loading={loading}
            formInvalid={config.validation.formInvalid}
            strategiesLoading={config.strategiesLoading}
            disabled={disabled}
            onExpand={() => handleFocusChange('setup')}
            onRun={handleRunFromTeaser}
          />
        ) : null}
      </section>

      <section
        className="relative flex min-h-0 flex-col overflow-hidden"
        aria-expanded={resultsExpanded}
      >
        <div
          className={cn(
            'flex min-h-0 flex-col overflow-hidden',
            resultsExpanded ? 'flex-1' : 'hidden',
          )}
          aria-hidden={!resultsExpanded}
        >
          {isRunning && status ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <OptimizationProgress
                status={status}
                onCancel={onCancel}
                cancelling={cancelling}
                cancelError={cancelError}
              />
            </div>
          ) : status?.status === 'error' ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="max-w-md rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-sm break-words text-rose-400">
                Optimization failed: {status.error ?? 'unknown error'}
              </div>
            </div>
          ) : hasResults ? (
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col overflow-hidden',
                !chartsReady && 'invisible',
              )}
            >
              <OptimizationResultsTabs
                results={results!}
                backtest={backtest!}
                statusLabel={statusLabel}
              />
            </div>
          ) : (
            <div className="border-carbon-600/60 flex flex-1 items-center justify-center rounded-xl border-2 border-dashed">
              <p className="text-silver-400 text-sm">Run an optimization to see results here.</p>
            </div>
          )}
        </div>

        {!resultsExpanded ? (
          <CollapsedOptimizeResultsTeaser
            isRunning={isRunning}
            hasResults={hasResults}
            status={status}
            results={results}
            onExpand={() => handleFocusChange('results')}
            onOpenHistory={onOpenHistory}
          />
        ) : null}
      </section>
    </div>
  )
}
