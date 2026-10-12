import type { BacktestStatusResponse } from '../../../contracts/api'

export type BacktestLiveStatus = BacktestStatusResponse & {
  /** Client-only: the current response omitted telemetry retained from an earlier response. */
  telemetryUnavailable?: boolean
  /** Client time when updated_at last changed; survives workspace navigation via the query cache. */
  updateObservedAt?: number
}
export type BacktestPhase = NonNullable<BacktestStatusResponse['phase']>
export const BACKTEST_PHASES: { id: BacktestPhase; label: string }[] = [
  { id: 'queued', label: 'Queued' },
  { id: 'loading_data', label: 'Loading data' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'simulating', label: 'Simulating' },
  { id: 'saving', label: 'Saving' },
]
const ACTIVITY_LABELS = {
  loading_candles: 'Loading historical candles',
  loading_ticks: 'Loading historical ticks',
  computing: 'Simulating strategy',
  reading_m1: 'Reading M1 candles',
  reading_ticks: 'Reading trade ticks',
  saving: 'Saving results',
}
export function retainBacktestProgress(
  previous: BacktestLiveStatus | undefined,
  next: BacktestLiveStatus,
): BacktestLiveStatus {
  if (next.status !== 'running') return next
  const sameRun = previous?.run_id === next.run_id
  const missing = next.phase == null
  // Database fallbacks may explicitly null every optional field.
  const result =
    missing && sameRun && previous?.phase
      ? { ...previous, run_id: next.run_id, status: next.status, error: next.error }
      : next
  return {
    ...result,
    telemetryUnavailable: missing,
    updateObservedAt:
      sameRun && previous?.updated_at === result.updated_at
        ? (previous.updateObservedAt ?? Date.now())
        : Date.now(),
  }
}
export function backtestProgressPercent(status: BacktestStatusResponse | undefined): number | null {
  return status?.phase === 'simulating' &&
    typeof status.progress === 'number' &&
    Number.isFinite(status.progress)
    ? Math.round(Math.min(1, Math.max(0, status.progress)) * 100)
    : null
}
export function backtestActivityLabel(status: BacktestStatusResponse | undefined): string {
  if (!status) return 'Starting backtest…'
  if (!status.phase) return 'Detailed progress unavailable'
  if (status.activity) {
    if (status.activity.kind === 'computing' && status.phase === 'preparing')
      return 'Preparing strategy and indicators'
    return ACTIVITY_LABELS[status.activity.kind]
  }
  return status.message || BACKTEST_PHASES.find((step) => step.id === status.phase)!.label
}
export function backtestPhaseLabel(status: BacktestLiveStatus | undefined): string {
  if (!status) return 'Starting backtest…'
  if (status.telemetryUnavailable || !status.phase) return 'Detailed progress unavailable'
  const label = status.activity
    ? backtestActivityLabel(status)
    : BACKTEST_PHASES.find((step) => step.id === status.phase)!.label
  const pct = backtestProgressPercent(status)
  return pct == null ? label : `${label} · ${pct}% of historical range`
}
export function formatBacktestDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
