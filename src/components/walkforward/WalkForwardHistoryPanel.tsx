import { formatDistanceToNow } from 'date-fns'
import { Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'

import {
  useDeleteWalkForward,
  useWalkForwardEquityArtifact,
  useWalkForwardHistory,
  useWalkForwardResults,
  useWalkForwardStatus,
} from '@/api/queries/walkforward'
import { WalkForwardResultsView } from '@/components/walkforward/WalkForwardResultsView'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { formatEfficiencyRatio } from '@/lib/walkforward/objectiveMetric'
import { cn } from '@/lib/utils'
import type { WalkForwardJobStatus, WalkForwardRunSummary } from '@/types/walkforward'
import { shouldFetchWalkForwardResults } from '@/types/walkforward'

type WalkForwardHistoryPanelProps = {
  selectedRunId: string | null
  onSelectRun: (runId: string | null) => void
}

const statusStyles: Record<WalkForwardJobStatus, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-rose-500/10 text-rose-400',
  cancelled: 'bg-silver-500/10 text-silver-400',
  running: 'bg-brass-500/10 text-brass-400',
  pending: 'bg-silver-500/10 text-silver-400',
}

function RunListItem({
  run,
  selected,
  onSelect,
}: {
  run: WalkForwardRunSummary
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'border-carbon-600/60 hover:border-brass-500/40 w-full rounded-lg border p-3 text-left transition-colors',
        selected ? 'border-brass-500/60 bg-brass-500/5' : 'bg-carbon-900/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-silver-100 truncate text-sm font-medium">{run.name}</p>
          <p className="text-silver-400 mt-0.5 text-xs">
            {run.symbol ?? '—'} · {run.strategy ?? '—'} · {run.window_count} windows ·{' '}
            {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
            statusStyles[run.status],
          )}
        >
          {run.status}
        </span>
      </div>
      <div className="text-silver-300 mt-2 text-xs tabular-nums">
        Efficiency <span className="text-brass-400">{formatEfficiencyRatio(run.efficiency)}</span>
      </div>
    </button>
  )
}

export function WalkForwardHistoryPanel({
  selectedRunId,
  onSelectRun,
}: WalkForwardHistoryPanelProps) {
  const historyQuery = useWalkForwardHistory()
  const statusQuery = useWalkForwardStatus(selectedRunId)
  const deleteRun = useDeleteWalkForward()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const status = statusQuery.data
  const hasTerminalResults = shouldFetchWalkForwardResults(status?.status)
  const resultsQuery = useWalkForwardResults(selectedRunId, hasTerminalResults)
  const equityArtifactQuery = useWalkForwardEquityArtifact(
    selectedRunId,
    hasTerminalResults && !!resultsQuery.data && resultsQuery.data.equity_curve.length === 0,
  )

  const runs = historyQuery.data?.items ?? []
  const selectedRun = runs.find((run) => run.run_id === selectedRunId)

  const mergedResults =
    resultsQuery.data && equityArtifactQuery.data?.points.length
      ? {
          ...resultsQuery.data,
          equity_curve: equityArtifactQuery.data.points,
        }
      : resultsQuery.data

  const backtest = status?.backtest_config ?? mergedResults?.optimization_config?.backtest ?? null

  const handleDelete = () => {
    if (!selectedRunId) return
    deleteRun.mutate(selectedRunId, {
      onSuccess: () => {
        onSelectRun(null)
        setConfirmDelete(false)
      },
    })
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div className="bg-carbon-900/50 border-carbon-600/60 flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border">
          <div className="border-carbon-600/60 shrink-0 border-b px-4 py-3">
            <h3 className="text-silver-100 font-medium">Past Runs</h3>
            <p className="text-silver-400 mt-0.5 text-xs">
              {historyQuery.isLoading
                ? 'Loading…'
                : `${historyQuery.data?.total ?? runs.length} run${(historyQuery.data?.total ?? runs.length) === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {historyQuery.isLoading && (
              <div className="text-silver-400 flex items-center justify-center gap-2 py-8 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history…
              </div>
            )}

            {!historyQuery.isLoading && runs.length === 0 && (
              <p className="text-silver-400 px-1 py-8 text-center text-sm">
                No walk-forward runs yet.
              </p>
            )}

            {runs.map((run) => (
              <RunListItem
                key={run.run_id}
                run={run}
                selected={selectedRunId === run.run_id}
                onSelect={() => onSelectRun(run.run_id)}
              />
            ))}
          </div>
        </div>

        <div className="bg-carbon-900/50 border-carbon-600/60 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">
          {!selectedRunId ? (
            <div className="text-silver-400 flex flex-1 flex-col items-center justify-center px-6 text-center">
              <RotateCcw className="text-silver-500 mb-3 h-8 w-8" />
              <p className="text-silver-200 font-medium">Select a run</p>
              <p className="mt-1 max-w-sm text-sm">
                Open a past walk-forward run to review OOS equity, per-window metrics, and
                efficiency.
              </p>
            </div>
          ) : statusQuery.isLoading ? (
            <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading run status…
            </div>
          ) : status?.status === 'failed' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-silver-100 text-lg font-semibold">
                    {selectedRun?.name ?? selectedRunId}
                  </h3>
                  <p className="text-silver-400 mt-1 text-sm">
                    {formatDisplayDateTime(selectedRun?.created_at ?? new Date().toISOString())}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-rose-400"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
                {status.error ?? 'Walk-forward run failed.'}
              </div>
            </div>
          ) : resultsQuery.isLoading || equityArtifactQuery.isLoading ? (
            <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading results…
            </div>
          ) : mergedResults && backtest ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
              <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
                <div>
                  <h3 className="text-silver-100 text-lg font-semibold">
                    {selectedRun?.name ?? selectedRunId}
                  </h3>
                  <p className="text-silver-400 mt-1 text-sm">
                    {backtest.symbol} · {backtest.timeframe ?? 'D1'} ·{' '}
                    {formatDisplayDateTime(selectedRun?.created_at ?? new Date().toISOString())}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-rose-400"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
              <WalkForwardResultsView results={mergedResults} backtest={backtest} />
            </div>
          ) : (
            <div className="text-silver-400 flex flex-1 items-center justify-center px-6 text-center text-sm">
              Results unavailable for this run.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete walk-forward run?"
        description={`Remove "${selectedRun?.name ?? selectedRunId}" and its lake artifacts.`}
        confirmLabel="Delete"
        loading={deleteRun.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
