import { useEffect, useId, useState } from 'react'
import { Check, ChevronDown, LoaderCircle } from 'lucide-react'

import { Button, Panel } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import {
  BACKTEST_PHASES,
  backtestActivityLabel,
  backtestProgressPercent,
  formatBacktestDuration,
  type BacktestLiveStatus,
} from '@/lib/backtesting/backtestProgress'
import type { BacktestRequest } from '@/types/backtesting'

export { backtestPhaseLabel } from '@/lib/backtesting/backtestProgress'
export const STALL_AFTER_MS = 10_000
const READ_KINDS = new Set(['loading_candles', 'loading_ticks', 'reading_m1', 'reading_ticks'])
const formatHistoryTime = (value: string) =>
  value.replace('T', ' ').replace(/:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/, '')

type Props = {
  status: BacktestLiveStatus | undefined
  request: BacktestRequest | null
  /** Cancels the run; the control is hidden when omitted. */
  onCancel?: () => void
  cancelling?: boolean
  cancelError?: string | null
}
export function BacktestRunProgress(props: Props) {
  return <RunProgress key={props.status?.run_id ?? 'submitting'} {...props} />
}
function RunProgress({ status, request, onCancel, cancelling = false, cancelError }: Props) {
  const reduceMotion = useReducedMotion()
  const [now, setNow] = useState(() => Date.now())
  const [changedAt, setChangedAt] = useState(() => Date.now())
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    setChangedAt(Date.now())
  }, [status?.updated_at])
  const phase = status?.phase
  const currentIndex = BACKTEST_PHASES.findIndex((step) => step.id === phase)
  const pct = backtestProgressPercent(status)
  const startedAt = status?.started_at ? Date.parse(status.started_at) : changedAt
  const elapsed = now - (Number.isFinite(startedAt) ? startedAt : changedAt)
  const updateAge = Math.max(0, now - (status?.updateObservedAt ?? changedAt))
  const missing = status?.telemetryUnavailable || (status != null && !phase)
  const reportedAt = status?.updated_at ? Date.parse(status.updated_at) : Number.NaN
  const activityNow = missing && Number.isFinite(reportedAt) ? reportedAt : now
  const stale = Boolean(status?.updated_at) && updateAge >= STALL_AFTER_MS
  const activity = status?.activity
  const reading = activity != null && READ_KINDS.has(activity.kind)
  const readStarted = activity ? Date.parse(activity.started_at) : Number.NaN
  const heading = backtestActivityLabel(status)
  return (
    <Panel className="mx-auto w-full max-w-[960px] shrink-0 p-5 sm:p-7" overflowVisible>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="accent-wayfinding font-semibold tracking-wider uppercase">
          Backtest {phase === 'queued' ? 'queued' : 'running'}
        </span>
        {request ? (
          <span className="text-silver-300">
            {request.strategy} · {request.symbol}
            {request.timeframe ? ` · ${request.timeframe}` : ''}
          </span>
        ) : null}
      </div>
      {onCancel ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="cancel-simulation-button"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling…' : 'Cancel Run'}
          </Button>
          {cancelError ? (
            <p role="alert" className="text-sm text-red-400">
              {cancelError}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-6 flex items-start gap-3">
        <LoaderCircle
          aria-hidden="true"
          className={cn(
            'text-brass-400 mt-1 h-5 w-5 shrink-0',
            !reduceMotion && 'motion-safe:animate-spin',
          )}
        />
        <div className="min-w-0">
          <h2 className="text-silver-100 text-xl font-medium sm:text-2xl">{heading}</h2>
          {reading && Number.isFinite(readStarted) ? (
            <p className="text-silver-300 mt-1 text-sm">
              {missing ? 'Last reported read' : 'Read in progress'} ·{' '}
              {formatBacktestDuration(activityNow - readStarted)}
            </p>
          ) : null}
          {missing && phase ? (
            <p className="text-silver-300 mt-1 text-sm">
              Detailed progress unavailable · showing last known activity
            </p>
          ) : null}
        </div>
      </div>
      {phase ? (
        <ol
          aria-label="Backtest phases"
          className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5"
        >
          {BACKTEST_PHASES.map((step, index) => {
            const state =
              index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending'
            return (
              <li
                key={step.id}
                aria-current={state === 'current' ? 'step' : undefined}
                data-state={state}
                className={cn(
                  'flex items-center gap-2 text-xs',
                  state === 'current'
                    ? 'text-brass-300 font-semibold'
                    : state === 'done'
                      ? 'text-silver-300'
                      : 'text-silver-500',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    state === 'current' ? 'border-brass-500 bg-brass-500/10' : 'border-carbon-600',
                  )}
                >
                  {state === 'done' ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                {step.label}
              </li>
            )
          })}
        </ol>
      ) : null}
      {pct != null ? (
        <div className="mt-6">
          <div className="text-silver-300 mb-2 flex justify-between gap-3 text-xs">
            <span>Historical range processed</span>
            <span className="text-brass-300 font-mono tabular-nums">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Historical range processed"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="surface-well h-1.5 overflow-hidden rounded-full"
          >
            <div
              className={cn(
                'bg-brass-400 h-full rounded-full',
                !reduceMotion && 'motion-safe:transition-[width] motion-safe:duration-300',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-silver-400 mt-2 text-xs">
            Historical coverage, not a time estimate. Data reads vary in duration.
          </p>
        </div>
      ) : null}
      <div className="border-carbon-600/60 mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs">
        <span className="text-silver-300">
          Elapsed{' '}
          <span className="text-silver-100 ml-1 font-mono tabular-nums">
            {formatBacktestDuration(elapsed)}
          </span>
        </span>
        <span
          className={cn('text-silver-400', (stale || missing) && 'text-brass-300')}
          role={stale || missing ? 'status' : undefined}
        >
          {missing
            ? `Progress details unavailable${stale ? ` · no new progress update for ${formatBacktestDuration(updateAge)}` : ''}`
            : stale
              ? `No new progress update for ${formatBacktestDuration(updateAge)}`
              : status?.updated_at
                ? `Last update ${formatBacktestDuration(updateAge)} ago`
                : 'Waiting for first progress update'}
        </span>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded(!expanded)}
        className="text-silver-300 hover:text-brass-300 focus-visible:ring-brass-500 mt-4 flex cursor-pointer items-center gap-2 self-start rounded py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
      >
        Run details{' '}
        <ChevronDown aria-hidden="true" className={cn('h-3.5 w-3.5', expanded && 'rotate-180')} />
      </button>
      {expanded ? (
        <div id={detailsId} className="border-carbon-600/60 mt-3 space-y-5 border-t pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs sm:grid-cols-3">
            {status?.bars_total != null ? (
              <Detail label="Total candles" value={status.bars_total.toLocaleString()} />
            ) : null}
            {status?.candles_replayed != null ? (
              <Detail label="Completed replays" value={status.candles_replayed.toLocaleString()} />
            ) : null}
            {status?.candles_substituted != null ? (
              <Detail
                label="Substituted candles"
                value={status.candles_substituted.toLocaleString()}
              />
            ) : null}
            {status?.simulated_until ? (
              <Detail
                label="Last completed replay"
                value={formatHistoryTime(status.simulated_until)}
              />
            ) : null}
            {activity?.range_start && activity.range_end ? (
              <Detail
                label="Requested read range"
                value={`${formatHistoryTime(activity.range_start)} → ${formatHistoryTime(activity.range_end)}`}
                wide
              />
            ) : null}
          </dl>
          {status?.phase_history?.length ? (
            <div>
              <p className="text-silver-400 mb-2 text-xs">Phase timings</p>
              <ol aria-label="Phase timings" className="space-y-2 text-xs">
                {status.phase_history.map((entry) => (
                  <li key={entry.phase} className="flex justify-between gap-4">
                    <span className="text-silver-300">
                      {BACKTEST_PHASES.find((step) => step.id === entry.phase)?.label}
                    </span>
                    <span className="text-silver-100 font-mono tabular-nums">
                      {formatBacktestDuration(
                        (entry.finished_at ? Date.parse(entry.finished_at) : activityNow) -
                          Date.parse(entry.started_at),
                      )}
                      {!entry.finished_at ? (missing ? ' · last reported' : ' · active') : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {!phase ? (
            <p className="text-silver-400 text-xs">
              Detailed progress unavailable. The backtest status will still update when it finishes.
            </p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  )
}
function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <dt className="text-silver-400">{label}</dt>
      <dd className="text-silver-100 mt-1 font-mono break-words tabular-nums">{value}</dd>
    </div>
  )
}
