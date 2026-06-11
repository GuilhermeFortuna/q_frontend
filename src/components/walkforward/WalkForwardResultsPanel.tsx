import { Button } from '@/components/ui/button'
import { WalkForwardProgress } from '@/components/walkforward/WalkForwardProgress'
import { WalkForwardResultsView } from '@/components/walkforward/WalkForwardResultsView'
import type { OptimizationBacktestConfig } from '@/types/optimization'
import type { WalkForwardResults, WalkForwardStatus } from '@/types/walkforward'

type WalkForwardResultsPanelProps = {
  isRunning: boolean
  status: WalkForwardStatus | undefined
  results: WalkForwardResults | undefined
  backtest: OptimizationBacktestConfig | null
  onCancel: () => void
  cancelling: boolean
  onOpenWorkbench: () => void
}

export function WalkForwardResultsPanel({
  isRunning,
  status,
  results,
  backtest,
  onCancel,
  cancelling,
  onOpenWorkbench,
}: WalkForwardResultsPanelProps) {
  if (isRunning && status) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <WalkForwardProgress status={status} onCancel={onCancel} cancelling={cancelling} />
      </div>
    )
  }

  if (status?.status === 'failed') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="max-w-md rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-sm break-words text-rose-400">
          Walk-forward failed: {status.error ?? 'unknown error'}
        </div>
      </div>
    )
  }

  if (results && backtest) {
    const statusLabel =
      status?.status === 'cancelled' ? 'Run cancelled — showing partial OOS results' : undefined

    return (
      <WalkForwardResultsView results={results} backtest={backtest} statusLabel={statusLabel} />
    )
  }

  return (
    <div className="border-carbon-600/60 flex min-h-0 flex-1 items-center justify-center rounded-xl border-2 border-dashed bg-transparent">
      <div className="text-center">
        <h3 className="text-silver-200 text-xl font-medium">No Walk-Forward Run Yet</h3>
        <p className="text-silver-400 mt-2 max-w-sm text-sm">
          Configure optimizer settings and walk-forward windows, then launch a run to see the
          stitched OOS verdict.
        </p>
        <Button type="button" variant="brass" className="mt-4" onClick={onOpenWorkbench}>
          Open Workbench
        </Button>
      </div>
    </div>
  )
}
