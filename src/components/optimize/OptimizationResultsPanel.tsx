import { Button, Callout } from '@/components/ui'
import { OptimizationProgress } from '@/components/optimize/OptimizationProgress'
import { OptimizationResultsTabs } from '@/components/optimize/OptimizationResultsTabs'
import { buildResultsFromStatus } from '@/lib/optimize/buildResultsFromStatus'
import type {
  OptimizationBacktestConfig,
  OptimizationResults,
  OptimizationStatus,
} from '@/types/optimization'

type OptimizationResultsPanelProps = {
  isRunning: boolean
  status: OptimizationStatus | undefined
  results: OptimizationResults | undefined
  backtest: OptimizationBacktestConfig | null
  onCancel: () => void
  cancelling: boolean
  cancelError?: string | null
  onOpenWorkbench: () => void
}

export function OptimizationResultsPanel({
  isRunning,
  status,
  results,
  backtest,
  onCancel,
  cancelling,
  cancelError,
  onOpenWorkbench,
}: OptimizationResultsPanelProps) {
  if (isRunning && status) {
    if (status.backtest_config) {
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <OptimizationResultsTabs
            results={buildResultsFromStatus(status)}
            backtest={status.backtest_config}
            status={status.status}
            liveStatus={status}
            onCancel={onCancel}
            cancelling={cancelling}
            cancelError={cancelError}
          />
        </div>
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <OptimizationProgress
          status={status}
          onCancel={onCancel}
          cancelling={cancelling}
          cancelError={cancelError}
        />
      </div>
    )
  }

  if (status?.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <Callout type="error" title="Optimization Failed" className="max-w-md">
          Optimization failed: {status.error ?? 'unknown error'}
        </Callout>
      </div>
    )
  }

  if (results && backtest) {
    const statusLabel =
      status?.status === 'cancelled' ? 'Study cancelled — showing partial results' : undefined

    return (
      <OptimizationResultsTabs
        results={results}
        backtest={backtest}
        status={status?.status ?? 'done'}
        statusLabel={statusLabel}
      />
    )
  }

  return (
    <div className="border-carbon-600/60 flex min-h-0 flex-1 items-center justify-center rounded-xl border-2 border-dashed bg-transparent">
      <div className="text-center">
        <h3 className="text-silver-200 text-xl font-medium">No Optimization Yet</h3>
        <p className="text-silver-400 mt-2 max-w-sm text-sm">
          Configure your search space in the workbench and launch a study to explore strategy and
          risk parameters.
        </p>
        <Button type="button" variant="brass" className="mt-4" onClick={onOpenWorkbench}>
          Open Workbench
        </Button>
      </div>
    </div>
  )
}
