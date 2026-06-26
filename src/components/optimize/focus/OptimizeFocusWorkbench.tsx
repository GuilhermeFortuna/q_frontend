import { useCallback, useMemo, useRef } from 'react'

import { CollapsedOptimizeResultsTeaser } from '@/components/optimize/focus/CollapsedOptimizeResultsTeaser'
import { CollapsedOptimizeSetupTeaser } from '@/components/optimize/focus/CollapsedOptimizeSetupTeaser'
import { OptimizationResultsTabs } from '@/components/optimize/OptimizationResultsTabs'
import { OptimizeSetupPanel } from '@/components/optimize/setup/OptimizeSetupPanel'
import { buildResultsFromStatus } from '@/lib/optimize/buildResultsFromStatus'
import type { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import { cn } from '@/lib/utils'
import { Callout } from '@/components/ui'
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
 * Focus invariant: exactly one pane is visually expanded. Inactive panes are
 * parked (unmounted) while setup fields remain in the parent config hook.
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

  const handleFocusChange = useCallback(
    (next: BacktestWorkbenchFocus) => {
      if (next === focus) return
      onFocusChange(next)
    },
    [focus, onFocusChange],
  )

  const handleRunFromTeaser = useCallback(() => {
    if (config.validation.formInvalid || config.strategiesLoading || loading || disabled) return
    if (!config.selectedStrategy) return
    onSubmit(config.buildOptimizationConfig())
  }, [config, disabled, loading, onSubmit])

  const setupExpanded = focus === 'setup'
  const resultsExpanded = focus === 'results'

  const statusLabel = useMemo(
    () =>
      status?.status === 'cancelled' ? 'Study cancelled — showing partial results' : undefined,
    [status?.status],
  )

  const liveResults = useMemo(() => (status ? buildResultsFromStatus(status) : undefined), [status])

  const activeBacktest = backtest ?? status?.backtest_config ?? null
  const canShowResults = Boolean((results ?? liveResults) && activeBacktest)
  const displayResults = results ?? liveResults
  const hasResults = canShowResults

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
            <OptimizeSetupPanel
              config={config}
              loading={loading}
              error={error}
              disabled={disabled}
              onSubmit={onSubmit}
            />
          </div>
        ) : (
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
        )}
      </section>

      <section
        className="relative flex min-h-0 flex-col overflow-hidden"
        aria-expanded={resultsExpanded}
      >
        {resultsExpanded ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {status?.status === 'error' ? (
              <div className="flex flex-1 items-center justify-center p-4">
                <Callout type="error" title="Optimization Failed" className="max-w-md">
                  Optimization failed: {status.error ?? 'unknown error'}
                </Callout>
              </div>
            ) : hasResults ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <OptimizationResultsTabs
                  results={displayResults!}
                  backtest={activeBacktest!}
                  status={status?.status ?? 'done'}
                  statusLabel={statusLabel}
                  liveStatus={isRunning ? status : undefined}
                  onCancel={onCancel}
                  cancelling={cancelling}
                  cancelError={cancelError}
                />
              </div>
            ) : (
              <div className="border-carbon-600/60 flex flex-1 items-center justify-center rounded-xl border-2 border-dashed">
                <p className="text-silver-400 text-sm">Run an optimization to see results here.</p>
              </div>
            )}
          </div>
        ) : (
          <CollapsedOptimizeResultsTeaser
            isRunning={isRunning}
            hasResults={hasResults}
            status={status}
            results={results}
            onExpand={() => handleFocusChange('results')}
            onOpenHistory={onOpenHistory}
          />
        )}
      </section>
    </div>
  )
}
