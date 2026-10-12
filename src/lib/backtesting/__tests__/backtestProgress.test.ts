import { describe, expect, it } from 'vitest'
import { retainBacktestProgress, type BacktestLiveStatus } from '../backtestProgress'
const live: BacktestLiveStatus = {
  run_id: 'a',
  status: 'running',
  phase: 'simulating',
  progress: 0.4,
  updated_at: '2026-10-12T07:15:00Z',
  candles_replayed: 12,
}
describe('retained backtest telemetry', () => {
  it('keeps the same run’s last measured details and marks a database fallback stale', () => {
    const retained = retainBacktestProgress(live, { run_id: 'a', status: 'running' })
    expect(retained.progress).toBe(0.4)
    expect(retained.updated_at).toBe('2026-10-12T07:15:00Z')
    expect(retained.telemetryUnavailable).toBe(true)
    expect(retainBacktestProgress(retained, { ...live, progress: 0.6 }).telemetryUnavailable).toBe(
      false,
    )
  })
  it('never transfers telemetry to another run or overrides a terminal state', () => {
    expect(
      retainBacktestProgress(live, { run_id: 'b', status: 'running' }).progress,
    ).toBeUndefined()
    expect(retainBacktestProgress(live, { run_id: 'a', status: 'completed' })).toEqual({
      run_id: 'a',
      status: 'completed',
    })
    expect(
      retainBacktestProgress(live, { run_id: 'a', status: 'failed', error: 'read failed' }).error,
    ).toBe('read failed')
  })
})
