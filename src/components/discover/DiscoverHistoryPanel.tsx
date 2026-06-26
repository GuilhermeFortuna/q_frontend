import { formatDistanceToNow } from 'date-fns'
import { Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'

import {
  useDeleteStrategySearch,
  useStrategySearchHistory,
  useStrategySearchResults,
  useStrategySearchStatus,
  useCancelStrategySearch,
} from '@/api/queries/strategySearch'
import { DiscoverResultsPanel } from '@/components/discover/DiscoverResultsPanel'
import { Button, ConfirmDialog, Panel, PanelHeader, Callout, HistoryCard } from '@/components/ui'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { formatObjectiveMetricValue, objectiveMetricLabel } from '@/lib/walkforward/objectiveMetric'
import type { StrategySearchJobStatus, StrategySearchRunSummary } from '@/types/strategySearch'
import { shouldFetchStrategySearchResults } from '@/types/strategySearch'

type DiscoverHistoryPanelProps = {
  selectedRunId: string | null
  onSelectRun: (runId: string | null) => void
}

const statusStyles: Record<StrategySearchJobStatus, string> = {
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
  run: StrategySearchRunSummary
  selected: boolean
  onSelect: () => void
}) {
  const metricsContent = (
    <div className="flex items-center justify-between text-[10px]">
      <div className="flex flex-col">
        <span className="text-silver-500 text-[8px] font-medium tracking-wider uppercase">
          Objective Metrics
        </span>
        <span className="text-silver-200 mt-0.5 text-[11px] font-semibold">
          {run.symbol ?? '—'} · {run.candidate_count} candidates
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-silver-500 text-[8px] font-medium tracking-wider uppercase">
          Best Strategy
        </span>
        <span
          className="text-brass-400 mt-0.5 max-w-[8rem] truncate text-[11px] font-bold"
          title={run.best_strategy ?? '—'}
        >
          {run.best_strategy ?? '—'}
          {run.best_objective_value != null ? ` (${run.best_objective_value.toFixed(3)})` : ''}
        </span>
      </div>
    </div>
  )

  return (
    <HistoryCard
      title={run.name}
      subtitle={formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
      status={run.status}
      statusClassName={statusStyles[run.status]}
      selected={selected}
      onSelect={onSelect}
      metrics={metricsContent}
    />
  )
}

export function DiscoverHistoryPanel({ selectedRunId, onSelectRun }: DiscoverHistoryPanelProps) {
  const historyQuery = useStrategySearchHistory()
  const statusQuery = useStrategySearchStatus(selectedRunId)
  const deleteRun = useDeleteStrategySearch()
  const cancelSearch = useCancelStrategySearch()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const status = statusQuery.data
  const hasTerminalResults = shouldFetchStrategySearchResults(status?.status)
  const resultsQuery = useStrategySearchResults(selectedRunId, hasTerminalResults)

  const runs = historyQuery.data?.items ?? []
  const selectedRun = runs.find((run) => run.run_id === selectedRunId)

  const backtest = status?.backtest_config ?? resultsQuery.data?.search_config?.backtest ?? null

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
        <Panel className="flex w-72 shrink-0 flex-col overflow-hidden p-0">
          <PanelHeader
            title="Past Searches"
            right={
              historyQuery.isLoading
                ? 'Loading…'
                : `${historyQuery.data?.total ?? runs.length} search${(historyQuery.data?.total ?? runs.length) === 1 ? '' : 'es'}`
            }
          />

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {historyQuery.isLoading ? (
              <div className="text-silver-400 flex items-center justify-center gap-2 py-8 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history…
              </div>
            ) : null}

            {!historyQuery.isLoading && runs.length === 0 ? (
              <p className="text-silver-400 px-1 py-8 text-center text-sm">
                No strategy searches yet.
              </p>
            ) : null}

            {runs.map((run) => (
              <RunListItem
                key={run.run_id}
                run={run}
                selected={selectedRunId === run.run_id}
                onSelect={() => onSelectRun(run.run_id)}
              />
            ))}
          </div>
        </Panel>

        <Panel className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
          {!selectedRunId ? (
            <div className="text-silver-400 flex flex-1 flex-col items-center justify-center px-6 text-center">
              <RotateCcw className="text-silver-500 mb-3 h-8 w-8" />
              <p className="text-silver-200 font-medium">Select a search</p>
              <p className="mt-1 max-w-sm text-sm">
                Open a past strategy search to review the OOS-ranked leaderboard and expand
                candidates.
              </p>
            </div>
          ) : statusQuery.isLoading ? (
            <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading search status…
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
              <Callout type="error" title="Search Failed">
                {status.error ?? 'Strategy search failed.'}
              </Callout>
            </div>
          ) : resultsQuery.isLoading ? (
            <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading results…
            </div>
          ) : status?.status === 'pending' ||
            status?.status === 'running' ||
            (resultsQuery.data && backtest) ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
              <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
                <div>
                  <h3 className="text-silver-100 text-lg font-semibold">
                    {selectedRun?.name ?? selectedRunId}
                  </h3>
                  <p className="text-silver-400 mt-1 text-sm">
                    {backtest?.symbol ?? '—'} · {backtest?.timeframe ?? 'D1'} ·{' '}
                    {formatDisplayDateTime(selectedRun?.created_at ?? new Date().toISOString())}
                    {resultsQuery.data?.best?.objective_value != null ? (
                      <>
                        {' · best OOS '}
                        {objectiveMetricLabel(resultsQuery.data.objective_mode)}:{' '}
                        {formatObjectiveMetricValue(
                          resultsQuery.data.best.objective_value,
                          resultsQuery.data.objective_mode,
                        )}
                      </>
                    ) : null}
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
              <DiscoverResultsPanel
                runId={selectedRunId}
                isRunning={status?.status === 'pending' || status?.status === 'running'}
                status={status}
                results={resultsQuery.data}
                backtest={backtest}
                onCancel={() => selectedRunId && cancelSearch.mutate(selectedRunId)}
                cancelling={cancelSearch.isPending}
                onOpenWorkbench={() => undefined}
              />
            </div>
          ) : (
            <div className="text-silver-400 flex flex-1 items-center justify-center px-6 text-center text-sm">
              Results unavailable for this search.
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete strategy search?"
        description={`Remove "${selectedRun?.name ?? selectedRunId}" and its lake artifacts.`}
        confirmLabel="Delete"
        loading={deleteRun.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
