import { formatDistanceToNow } from 'date-fns'
import { Loader2, Play, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'

import { useBacktestHistory, useBacktestRun } from '@/api/queries/backtests'
import { BacktestMetricsBar } from '@/components/backtests/BacktestMetricsBar'
import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import { Button } from '@/components/ui/button'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest, BacktestRunStatus, BacktestRunSummary } from '@/types/backtesting'

type BacktestHistoryPanelProps = {
  selectedRunId: string | null
  onSelectRun: (runId: string) => void
  onReRun: (request: BacktestRequest) => void
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
  onSelect,
}: {
  run: BacktestRunSummary
  selected: boolean
  onSelect: () => void
}) {
  const pnl = run.summary?.total_pnl
  const winRate = run.summary?.win_rate

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
          <p className="text-silver-100 truncate font-medium">
            {run.symbol} · {run.strategy}
          </p>
          <p className="text-silver-400 mt-0.5 text-xs">
            {run.timeframe} · {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
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

      {run.summary ? (
        <div className="text-silver-300 mt-2 flex gap-4 text-xs tabular-nums">
          <span>
            PnL{' '}
            <span className={pnl != null && pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {pnl != null ? formatSignedCurrency(pnl) : '—'}
            </span>
          </span>
          <span>
            Win rate{' '}
            <span className="text-silver-100">
              {winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
            </span>
          </span>
          <span>
            Trades <span className="text-silver-100">{run.summary.total_trades}</span>
          </span>
        </div>
      ) : (
        <p className="text-silver-500 mt-2 text-xs">
          {run.status === 'failed' ? 'Failed — metrics were not stored.' : 'No stored metrics yet.'}
        </p>
      )}
    </button>
  )
}

export function BacktestHistoryPanel({
  selectedRunId,
  onSelectRun,
  onReRun,
}: BacktestHistoryPanelProps) {
  const historyQuery = useBacktestHistory()
  const detailQuery = useBacktestRun(selectedRunId)
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)

  useEffect(() => {
    if (detailQuery.data?.config) {
      setPendingBacktestConfig(detailQuery.data.config)
    }
  }, [detailQuery.data, setPendingBacktestConfig])

  const runs = historyQuery.data?.items ?? []
  const detail = detailQuery.data

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
      <div className="border-carbon-600/60 flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border">
        <div className="border-carbon-600/60 shrink-0 border-b px-4 py-3">
          <h3 className="text-silver-100 font-medium">Past Runs</h3>
          <p className="text-silver-400 mt-0.5 text-xs">
            {historyQuery.isLoading
              ? 'Loading…'
              : `${historyQuery.data?.total ?? runs.length} saved simulation${(historyQuery.data?.total ?? runs.length) === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {historyQuery.isLoading && (
            <div className="text-silver-400 flex items-center justify-center gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history…
            </div>
          )}

          {historyQuery.isError && (
            <p className="px-1 py-4 text-sm text-rose-400">Failed to load backtest history.</p>
          )}

          {!historyQuery.isLoading && runs.length === 0 && (
            <p className="text-silver-400 px-1 py-8 text-center text-sm">
              No saved runs yet. Run a simulation to build history.
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

      <div className="border-carbon-600/60 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">
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
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium capitalize',
                  statusStyles[detail.status],
                )}
              >
                {detail.status}
              </span>
            </div>

            {detail.result_summary ? (
              <BacktestMetricsBar metrics={detail.result_summary} />
            ) : (
              <div className="border-carbon-600/60 bg-carbon-900/30 mb-4 rounded-lg border p-4">
                <p className="text-silver-300 text-sm">
                  {detail.status === 'failed'
                    ? 'This run failed before metrics could be stored.'
                    : 'No stored metrics for this run.'}
                  {detail.error_message ? ` ${detail.error_message}` : ''}
                </p>
              </div>
            )}

            <div className="border-carbon-600/60 bg-carbon-900/20 mb-4 rounded-lg border p-4">
              <h4 className="text-silver-200 mb-2 text-sm font-medium">Saved configuration</h4>
              <dl className="text-silver-400 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt>Capital</dt>
                  <dd className="text-silver-200">
                    {detail.config.initial_capital?.toLocaleString() ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt>Point value</dt>
                  <dd className="text-silver-200">{detail.config.point_value ?? '—'}</dd>
                </div>
                <div>
                  <dt>Short / Long</dt>
                  <dd className="text-silver-200">
                    {String(detail.config.strategy_params?.short_period ?? '—')} /{' '}
                    {String(detail.config.strategy_params?.long_period ?? '—')}
                  </dd>
                </div>
                <div>
                  <dt>Threshold</dt>
                  <dd className="text-silver-200">
                    {String(detail.config.strategy_params?.threshold ?? '—')}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-carbon-600/40 bg-brass-500/5 rounded-lg border p-4">
              <p className="text-silver-300 text-sm">
                Trade charts and indicator series are not persisted. The config has been loaded into
                the form — re-run the simulation to regenerate the full results.
              </p>
              <Button
                type="button"
                variant="brass"
                className="mt-3"
                onClick={() => onReRun(detail.config)}
              >
                <Play className="h-4 w-4" />
                Re-run simulation
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
