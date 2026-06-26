import { formatDistanceToNow } from 'date-fns'
import { Loader2, Play, RotateCcw, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  useBacktestHistoryInfinite,
  useBacktestRun,
  useBulkDeleteBacktests,
  useSaveBacktestRun,
} from '@/api/queries/backtests'
import { VirtualListScroller } from '@/components/shared/VirtualListScroller'
import {
  BacktestHistoryFilters,
  type BacktestHistoryTab,
} from '@/components/backtests/BacktestHistoryFilters'
import { BacktestMetricsBar } from '@/components/backtests/BacktestMetricsBar'
import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import {
  formatBulkDeleteDescription,
  HistorySelectionToolbar,
} from '@/components/shared/HistorySelectionToolbar'
import {
  Button,
  ConfirmDialog,
  Callout,
  KeyValueGrid,
  KeyValueItem,
  HistoryCard,
} from '@/components/ui'
import { useHistorySelection } from '@/hooks/useHistorySelection'
import { COMPARISON_MAX_RUNS } from '@/lib/backtesting/comparison'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type {
  BacktestHistorySort,
  BacktestRequest,
  BacktestRunStatus,
  BacktestRunSummary,
} from '@/types/backtesting'

type BacktestHistoryPanelProps = {
  selectedRunId: string | null
  onSelectRun: (runId: string | null) => void
  onReRun: (request: BacktestRequest) => void
  onCompare?: (runs: BacktestRunSummary[]) => void
}

const statusStyles: Record<BacktestRunStatus, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-rose-500/10 text-rose-400',
  running: 'bg-brass-500/10 text-brass-400',
  pending: 'bg-silver-500/10 text-silver-400',
}

function RunListItem({
  run,
  selected,
  selectionMode,
  checked,
  onSelect,
  onToggleCheck,
  onToggleSaved,
  saving,
}: {
  run: BacktestRunSummary
  selected: boolean
  selectionMode: boolean
  checked: boolean
  onSelect: () => void
  onToggleCheck: () => void
  onToggleSaved: () => void
  saving: boolean
}) {
  const pnl = run.summary?.total_pnl
  const winRate = run.summary?.win_rate

  const metricsContent = run.summary ? (
    <div className="flex items-center justify-between text-[10px]">
      <div className="flex flex-col">
        <span className="text-silver-500 text-[8px] font-medium tracking-wider uppercase">PnL</span>
        <span
          className={cn(
            'mt-0.5 font-mono text-[11px] font-bold',
            pnl != null && pnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
          )}
        >
          {pnl != null ? formatSignedCurrency(pnl) : '—'}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-silver-500 text-[8px] font-medium tracking-wider uppercase">
          Win Rate
        </span>
        <span className="text-silver-200 mt-0.5 font-mono text-[11px] font-semibold">
          {winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-silver-500 text-[8px] font-medium tracking-wider uppercase">
          Trades
        </span>
        <span className="text-silver-200 mt-0.5 font-mono text-[11px] font-semibold">
          {run.summary.total_trades}
        </span>
      </div>
    </div>
  ) : (
    <p className="text-silver-500 text-[10px] italic">
      {run.status === 'failed' ? 'Failed — metrics were not stored.' : 'No stored metrics yet.'}
    </p>
  )

  return (
    <HistoryCard
      title={`${run.symbol} · ${run.strategy}`}
      subtitle={`${run.timeframe} · ${formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}`}
      status={run.status}
      statusClassName={statusStyles[run.status]}
      selectionMode={selectionMode}
      checked={checked}
      onToggleCheck={onToggleCheck}
      showSaved
      isSaved={run.is_saved}
      onToggleSaved={onToggleSaved}
      saving={saving}
      selected={selected}
      onSelect={onSelect}
      metrics={metricsContent}
    />
  )
}

export function BacktestHistoryPanel({
  selectedRunId,
  onSelectRun,
  onReRun,
  onCompare,
}: BacktestHistoryPanelProps) {
  const [tab, setTab] = useState<BacktestHistoryTab>('all')
  const [symbolInput, setSymbolInput] = useState('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [strategyFilter, setStrategyFilter] = useState('')
  const [sort, setSort] = useState<BacktestHistorySort>('created_at_desc')
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const selection = useHistorySelection({ maxSelection: COMPARISON_MAX_RUNS })
  const saveBacktest = useSaveBacktestRun()
  const bulkDelete = useBulkDeleteBacktests()
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)

  useEffect(() => {
    const timer = window.setTimeout(() => setSymbolFilter(symbolInput.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [symbolInput])

  useEffect(() => {
    selection.exitSelectionMode()
  }, [tab, symbolFilter, strategyFilter, sort])

  const historyParams = useMemo(
    () => ({
      symbol: symbolFilter || undefined,
      strategy: strategyFilter || undefined,
      saved_only: tab === 'saved' ? true : undefined,
      sort,
    }),
    [tab, symbolFilter, strategyFilter, sort],
  )

  const historyQuery = useBacktestHistoryInfinite(historyParams)
  const detailQuery = useBacktestRun(selectedRunId)

  const runs = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data?.pages],
  )
  const total = historyQuery.data?.pages[0]?.total ?? runs.length

  useEffect(() => {
    if (detailQuery.data?.config) {
      setPendingBacktestConfig(detailQuery.data.config)
    }
  }, [detailQuery.data, setPendingBacktestConfig])

  const detail = detailQuery.data
  const pageRunIds = runs.map((run) => run.run_id)

  const selectedLabels = runs
    .filter((run) => selection.selectedIds.has(run.run_id))
    .map((run) => `${run.symbol} · ${run.strategy}`)

  const handleConfirmBulkDelete = () => {
    const ids = [...selection.selectedIds]
    if (ids.length === 0) return

    bulkDelete.mutate(ids, {
      onSuccess: () => {
        if (selectedRunId && ids.includes(selectedRunId)) {
          onSelectRun(null)
        }
        selection.exitSelectionMode()
        setConfirmBulkDelete(false)
      },
    })
  }

  const handleCompareSelected = () => {
    const selectedRuns = runs.filter((run) => selection.selectedIds.has(run.run_id))
    if (selectedRuns.length < 2) return
    onCompare?.(selectedRuns)
    selection.exitSelectionMode()
  }

  const subtitle =
    tab === 'saved'
      ? historyQuery.isLoading
        ? 'Loading…'
        : `${total} saved`
      : historyQuery.isLoading
        ? 'Loading…'
        : `${total} run${total === 1 ? '' : 's'}`

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div className="bg-carbon-900/50 border-carbon-600/60 flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border">
          <div className="border-carbon-600/60 shrink-0 border-b px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-silver-100 font-medium">Past Runs</h3>
                <p className="text-silver-400 mt-0.5 text-xs">{subtitle}</p>
              </div>
              <HistorySelectionToolbar
                selectionMode={selection.selectionMode}
                selectedCount={selection.selectedCount}
                pageItemCount={runs.length}
                onEnterSelection={selection.enterSelectionMode}
                onExitSelection={selection.exitSelectionMode}
                onSelectAllPage={() => selection.selectAll(pageRunIds)}
                onDeleteSelected={() => setConfirmBulkDelete(true)}
                onCompareSelected={onCompare ? handleCompareSelected : undefined}
                compareEnabled={
                  selection.selectedCount >= 2 && selection.selectedCount <= COMPARISON_MAX_RUNS
                }
                deleting={bulkDelete.isPending}
              />
            </div>
            {selection.selectionMode ? (
              <p className="text-silver-500 mt-2 text-xs">
                Select 2–{COMPARISON_MAX_RUNS} runs to compare.
                {selection.selectionAtMax
                  ? ' Maximum reached — deselect one to add another.'
                  : null}
                {selection.selectionBlocked ? ' Selection limit reached.' : null}
              </p>
            ) : null}
          </div>

          <BacktestHistoryFilters
            tab={tab}
            onTabChange={setTab}
            symbol={symbolInput}
            onSymbolChange={setSymbolInput}
            strategy={strategyFilter}
            onStrategyChange={setStrategyFilter}
            sort={sort}
            onSortChange={setSort}
          />

          {historyQuery.isLoading && (
            <div className="text-silver-400 flex items-center justify-center gap-2 px-3 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history…
            </div>
          )}

          {historyQuery.isError && (
            <p className="px-4 py-4 text-sm text-rose-400">Failed to load backtest history.</p>
          )}

          {!historyQuery.isLoading && runs.length === 0 && (
            <p className="text-silver-400 px-4 py-8 text-center text-sm">
              {tab === 'saved'
                ? 'No saved runs yet. Star a run to bookmark it.'
                : 'No runs match these filters. Run a simulation to build history.'}
            </p>
          )}

          {!historyQuery.isLoading && runs.length > 0 ? (
            <VirtualListScroller
              className="min-h-0 flex-1 p-3"
              items={runs}
              rowHeight={108}
              getItemKey={(index) => runs[index]!.run_id}
              renderItem={(run) => (
                <RunListItem
                  run={run}
                  selected={selectedRunId === run.run_id}
                  selectionMode={selection.selectionMode}
                  checked={selection.isSelected(run.run_id)}
                  onSelect={() => onSelectRun(run.run_id)}
                  onToggleCheck={() => selection.toggle(run.run_id)}
                  onToggleSaved={() =>
                    saveBacktest.mutate({ runId: run.run_id, isSaved: !run.is_saved })
                  }
                  saving={saveBacktest.isPending && saveBacktest.variables?.runId === run.run_id}
                />
              )}
            />
          ) : null}

          {historyQuery.hasNextPage ? (
            <div className="border-carbon-600/60 shrink-0 border-t p-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                disabled={historyQuery.isFetchingNextPage}
                onClick={() => historyQuery.fetchNextPage()}
              >
                {historyQuery.isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  `Load more (${runs.length} of ${total})`
                )}
              </Button>
            </div>
          ) : runs.length > 0 ? (
            <div className="text-silver-500 border-carbon-600/60 shrink-0 border-t px-3 py-2 text-center text-xs">
              Showing {runs.length} of {total}
            </div>
          ) : null}
        </div>

        <div className="bg-carbon-900/50 border-carbon-600/60 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">
          {!selectedRunId ? (
            <div className="text-silver-400 flex flex-1 flex-col items-center justify-center px-6 text-center">
              <RotateCcw className="text-silver-500 mb-3 h-8 w-8" />
              <p className="text-silver-200 font-medium">Select a run</p>
              <p className="mt-1 max-w-sm text-sm">
                Choose a past simulation to load its config into the form and review stored metrics.
                Charts are not saved — use Re-run to regenerate them.
              </p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading run details…
            </div>
          ) : detailQuery.isError || !detail ? (
            <div className="flex flex-1 items-center justify-center text-sm text-rose-400">
              Failed to load run details.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-silver-100 text-lg font-semibold">
                    {detail.symbol} · {detail.strategy}
                  </h3>
                  <p className="text-silver-400 mt-1 text-sm">
                    {detail.timeframe} · {formatDisplayDateTime(detail.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      saveBacktest.mutate({ runId: detail.run_id, isSaved: !detail.is_saved })
                    }
                    disabled={saveBacktest.isPending}
                    className={cn(
                      'rounded p-1.5 transition-colors disabled:opacity-50',
                      detail.is_saved
                        ? 'text-brass-400 hover:bg-brass-500/10'
                        : 'text-silver-500 hover:bg-brass-500/10 hover:text-brass-400',
                    )}
                    aria-label={detail.is_saved ? 'Unsave run' : 'Save run'}
                  >
                    <Star className={cn('h-4 w-4', detail.is_saved ? 'fill-current' : null)} />
                  </button>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium capitalize',
                      statusStyles[detail.status],
                    )}
                  >
                    {detail.status}
                  </span>
                </div>
              </div>

              {detail.result_summary ? (
                <BacktestMetricsBar metrics={detail.result_summary} />
              ) : (
                <Callout
                  type={detail.status === 'failed' ? 'error' : 'info'}
                  title={detail.status === 'failed' ? 'Run Failed' : 'No Metrics Available'}
                  className="mb-4"
                >
                  {detail.status === 'failed'
                    ? 'This run failed before metrics could be stored.'
                    : 'No stored metrics for this run.'}
                  {detail.error_message ? ` ${detail.error_message}` : ''}
                </Callout>
              )}

              <KeyValueGrid title="Saved configuration" cols={3} className="mb-4">
                <KeyValueItem
                  label="Capital"
                  value={detail.config.initial_capital?.toLocaleString() ?? '—'}
                />
                <KeyValueItem label="Point value" value={detail.config.point_value ?? '—'} />
                <KeyValueItem
                  label="Day trading"
                  value={
                    detail.config.day_trade
                      ? `Yes (${detail.config.day_trade_start_time}-${detail.config.day_trade_end_time}, close ${detail.config.day_trade_close_time})`
                      : 'No'
                  }
                />
              </KeyValueGrid>

              <Callout
                type="warning"
                title="Simulation Results Not Persisted"
                action={
                  <Button type="button" variant="brass" onClick={() => onReRun(detail.config)}>
                    <Play className="h-4 w-4" />
                    Re-run simulation
                  </Button>
                }
              >
                Trade charts and indicator series are not persisted. The config has been loaded into
                the form — re-run the simulation to regenerate the full results.
              </Callout>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selection.selectedCount} backtest run${selection.selectedCount === 1 ? '' : 's'}?`}
        description={formatBulkDeleteDescription(selectedLabels, 'runs')}
        confirmLabel="Delete"
        loading={bulkDelete.isPending}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </>
  )
}
