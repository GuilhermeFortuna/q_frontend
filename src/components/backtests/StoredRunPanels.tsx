import { ArrowLeft, Loader2 } from 'lucide-react'

import { isNotFoundError } from '@/api/queries/backtests'
import { Button, Callout } from '@/components/ui'
import { formatDisplayDateTime } from '@/lib/formatDate'
import type { BacktestRunDetail } from '@/types/backtesting'

export function StoredRunHeader({
  run,
  onBackToHistory,
}: {
  run: BacktestRunDetail
  onBackToHistory: () => void
}) {
  return (
    <div className="border-carbon-600/60 mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-3">
      <p className="text-silver-300 text-sm">
        <span className="text-silver-500 mr-2 text-xs font-medium tracking-wider uppercase">
          Stored run
        </span>
        {run.symbol} · {run.strategy} · {run.timeframe} · {formatDisplayDateTime(run.created_at)}
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={onBackToHistory}>
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to history
      </Button>
    </div>
  )
}

export function StoredResultLoading() {
  return (
    <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading stored result…
    </div>
  )
}

export function StoredResultNotice({
  run,
  error,
  onReRun,
}: {
  run: BacktestRunDetail | undefined
  error: unknown
  onReRun: (() => void) | undefined
}) {
  if (!isNotFoundError(error)) {
    return (
      <Callout type="error" title="Stored Result Unavailable">
        Could not load the stored result for this run.
      </Callout>
    )
  }

  if (run?.origin === 'script') {
    return (
      <Callout type="warning" title="Stored Result Missing">
        The stored result for this script run is missing. Script runs have no re-run action.
      </Callout>
    )
  }

  return (
    <Callout
      type="warning"
      title="Result Unavailable"
      action={
        onReRun ? (
          <Button type="button" variant="brass" onClick={onReRun}>
            Re-run simulation
          </Button>
        ) : null
      }
    >
      The stored result for this run is no longer stored. Re-run the simulation with the saved
      configuration to regenerate it.
    </Callout>
  )
}
