import { describe, expect, it } from 'vitest'

import { buildMockEquityCurveForTest } from '@/mocks/backtestEquity'
import {
  findBestMetricRunIndex,
  normalizeEquityPoints,
  shouldDefaultToPercentNormalization,
  startingEquityFromPoints,
} from '@/lib/backtesting/comparison'
import type { BacktestMetrics, BacktestRunSummary } from '@/types/backtesting'

const baseMetrics = (overrides: Partial<BacktestMetrics>): BacktestMetrics => ({
  total_trades: 10,
  total_pnl: 0,
  win_rate: 0.5,
  winning_trades: 5,
  losing_trades: 5,
  max_drawdown_value: 1000,
  max_drawdown_pct: 0.05,
  profit_factor: 1,
  recovery_factor: 1,
  expectancy: 0,
  avg_win: 100,
  avg_loss: -100,
  win_loss_ratio: 1,
  max_consecutive_wins: 2,
  max_consecutive_losses: 2,
  ...overrides,
})

const runSummary = (runId: string, summary: BacktestMetrics | null): BacktestRunSummary => ({
  run_id: runId,
  symbol: runId,
  strategy: 'MACrossover',
  timeframe: 'M5',
  status: 'completed',
  created_at: '2024-01-01T00:00:00.000Z',
  is_saved: false,
  summary,
})

describe('comparison helpers', () => {
  it('normalizes percent series to start at zero', () => {
    const points = [
      { time: '2024-01-01T00:00:00.000Z', equity: 100_000 },
      { time: '2024-06-01T00:00:00.000Z', equity: 110_000 },
    ]
    const normalized = normalizeEquityPoints(points, 'percent')

    expect(normalized[0]?.value).toBe(0)
    expect(normalized.at(-1)?.value).toBeCloseTo(10, 5)
  })

  it('defaults to percent normalization when starting capitals differ', () => {
    expect(shouldDefaultToPercentNormalization([100_000, 250_000])).toBe(true)
    expect(shouldDefaultToPercentNormalization([100_000, 100_000])).toBe(false)
  })

  it('highlights higher profit and lower drawdown correctly', () => {
    const runs = [
      runSummary('a', baseMetrics({ total_pnl: 1200, max_drawdown_pct: 0.04 })),
      runSummary('b', baseMetrics({ total_pnl: 800, max_drawdown_pct: 0.02 })),
    ]

    expect(findBestMetricRunIndex(runs, 'total_pnl', 'higher')).toBe(0)
    expect(findBestMetricRunIndex(runs, 'max_drawdown_pct', 'lower')).toBe(1)
  })

  it('reads starting equity from artifact points', () => {
    const points = buildMockEquityCurveForTest(50_000, 0.05)
    expect(startingEquityFromPoints(points)).toBe(points[0]?.equity)
  })
})
