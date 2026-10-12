import { useEffect, useState } from 'react'

import type { BacktestStatusResponse } from '../../../contracts/api'
import { Panel } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { BacktestRequest } from '@/types/backtesting'

type BacktestPhase = NonNullable<BacktestStatusResponse['phase']>

const PHASES: { id: BacktestPhase; label: string }[] = [
  { id: 'queued', label: 'Queued' },
  { id: 'loading_data', label: 'Loading data' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'simulating', label: 'Simulating' },
  { id: 'saving', label: 'Saving' },
]

/** A run whose updates stop for this long, in a phase that reads market data, is flagged as stalled. */
export const STALL_AFTER_MS = 10_000

const STALLABLE_PHASES: ReadonlySet<BacktestPhase> = new Set(['loading_data', 'simulating'])

const determinateProgress = (status: BacktestStatusResponse | undefined): number | null =>
  typeof status?.progress === 'number' ? status.progress : null

/** Phase name and percentage for the collapsed results teaser; the old label when the status has no phase. */
export function backtestPhaseLabel(status: BacktestStatusResponse | undefined): string {
  const phase = PHASES.find((step) => step.id === status?.phase)
  if (!phase) return 'Simulating…'
  const progress = determinateProgress(status)
  return progress == null ? phase.label : `${phase.label} · ${Math.round(progress * 100)}%`
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

type BacktestRunProgressProps = {
  status: BacktestStatusResponse | undefined
  request: BacktestRequest | null
}

export function BacktestRunProgress({ status, request }: BacktestRunProgressProps) {
  const [now, setNow] = useState(() => Date.now())
  // Measured on this client from when the update was first seen, so clock skew with the server does not matter.
  const [changedAt, setChangedAt] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setChangedAt(Date.now())
  }, [status?.updated_at])

  const startedAt = status?.started_at ? Date.parse(status.started_at) : Number.NaN
  const elapsed = now - (Number.isFinite(startedAt) ? startedAt : changedAt)
  const phase = status?.phase ?? null
  const currentIndex = PHASES.findIndex((step) => step.id === phase)
  const progress = determinateProgress(status)
  const pct = progress == null ? null : Math.min(100, Math.max(0, Math.round(progress * 100)))
  const stalledFor = now - changedAt
  const stalled = phase != null && STALLABLE_PHASES.has(phase) && stalledFor >= STALL_AFTER_MS
  const replayed = status?.candles_replayed ?? 0
  const substituted = status?.candles_substituted ?? 0
  const simulatedDate = status?.simulated_until?.slice(0, 10)
  const heading = status?.phase === 'queued' ? 'Backtest queued' : 'Backtest running'

  return (
    <Panel className="quant-panel--active-run min-h-0 flex-1 overflow-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="accent-wayfinding font-semibold uppercase">
          <span className="live-status-dot mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
          {heading}
        </span>
        {request ? (
          <span className="text-silver-300">
            {request.strategy} · {request.symbol}
            {request.timeframe ? ` · ${request.timeframe}` : ''}
          </span>
        ) : null}
      </div>

      {phase ? (
        <ol aria-label="Backtest phases" className="mt-3 flex flex-wrap gap-2 text-xs">
          {PHASES.map((step, index) => {
            const state =
              index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending'
            return (
              <li
                key={step.id}
                aria-current={state === 'current' ? 'step' : undefined}
                data-state={state}
                className={cn(
                  'rounded-full border px-3 py-1',
                  state === 'current' && 'border-brass-500 text-brass-300 font-semibold',
                  state === 'done' && 'border-carbon-600 text-silver-300',
                  state === 'pending' && 'border-carbon-700 text-silver-500',
                )}
              >
                {step.label}
              </li>
            )
          })}
        </ol>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <div
          className="surface-well h-2 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Backtest progress"
          aria-valuemin={0}
          aria-valuemax={100}
          {...(pct == null ? {} : { 'aria-valuenow': pct })}
        >
          <div
            className={cn(
              'from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r transition-all duration-500',
              pct == null && 'w-1/3 opacity-70 motion-safe:animate-pulse',
            )}
            style={pct == null ? undefined : { width: `${pct}%` }}
          />
        </div>
        <span className="text-silver-300 font-mono text-xs">
          {pct == null ? '' : `${pct}% · `}Elapsed {formatElapsed(elapsed)}
        </span>
      </div>

      <p className="text-silver-300 mt-2 text-xs">{status?.message || 'Running…'}</p>

      {replayed > 0 ? (
        <p className="text-silver-400 mt-1 text-xs">
          {simulatedDate ? `Simulated to ${simulatedDate} · ` : ''}
          {replayed} candles replayed
          {substituted > 0 ? ` · ${substituted} substituted` : ''}
        </p>
      ) : null}

      {stalled ? (
        <p role="status" className="text-brass-400 mt-2 text-xs">
          Waiting for market data · no update for {Math.floor(stalledFor / 1000)} s
        </p>
      ) : null}
    </Panel>
  )
}
