import { Button, Panel, Callout } from '@/components/ui'
import { WalkForwardProgress } from '@/components/walkforward/WalkForwardProgress'
import { WalkForwardResultsView } from '@/components/walkforward/WalkForwardResultsView'
import { SectionHeader } from '@/components/ui/SectionHeader'
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
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <Callout type="error" title="Walk-Forward Failed" className="max-w-md">
          Walk-forward failed: {status.error ?? 'unknown error'}
        </Callout>
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
    <Panel className="flex min-h-0 flex-1 items-center justify-center border-2 border-dashed bg-transparent">
      <div className="text-center">
        <SectionHeader title="No Walk-Forward Run Yet" className="justify-center" />
        <p className="text-silver-400 mt-2 max-w-sm text-sm">
          Configure optimizer settings and walk-forward windows, then launch a run to see the
          stitched OOS verdict.
        </p>
        <Button type="button" variant="brass" className="mt-4" onClick={onOpenWorkbench}>
          Open Workbench
        </Button>
      </div>
    </Panel>
  )
}
