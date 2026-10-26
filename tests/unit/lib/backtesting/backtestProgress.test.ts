import { describe, expect, it } from 'vitest'

import { backtestPhaseLabel, backtestProgressPercent } from '@/lib/backtesting/backtestProgress'

describe('backtest excursion progress', () => {
  it('reports measuring progress as completed trades', () => {
    const status = {
      run_id: 'run-1',
      status: 'running' as const,
      phase: 'measuring' as const,
      progress: 0.4,
      message: 'Measuring trade excursions · 2/5 trades',
      updated_at: '2026-10-25T12:00:00Z',
    }

    expect(backtestProgressPercent(status)).toBe(40)
    expect(backtestPhaseLabel({ ...status, telemetryUnavailable: false })).toContain(
      '40% of trades',
    )
  })
})
