import { Button } from '@/components/ui/button'
import { OptimizationProgress } from '@/components/optimize/OptimizationProgress'
import { OptimizationResultsTabs } from '@/components/optimize/OptimizationResultsTabs'
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
  onOpenWorkbench: () => void
}

export function OptimizationResultsPanel({
  isRunning,
  status,
  results,
  backtest,
  onCancel,
  cancelling,
  onOpenWorkbench,
}: OptimizationResultsPanelProps) {
  if (isRunning && status) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <OptimizationProgress status={status} onCancel={onCancel} cancelling={cancelling} />
      </div>
    )
  }

  if (status?.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="max-w-md rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-sm break-words text-rose-400">
          Optimization failed: {status.error ?? 'unknown error'}
        </div>
      </div>
    )
  }

  if (results && backtest) {
    const statusLabel =
      status?.status === 'cancelled' ? 'Study cancelled — showing partial results' : undefined

    return (
      <OptimizationResultsTabs results={results} backtest={backtest} statusLabel={statusLabel} />
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
