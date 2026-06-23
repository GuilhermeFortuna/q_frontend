import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useBacktestPerformanceData } from '@/lib/backtesting/useBacktestPerformanceData'
import { buildEquityCurve } from '@/lib/backtesting/performance'
import {
  computeBacktestPerformance,
  terminateBacktestPerformanceWorker,
  type BacktestPerformancePayload,
} from '@/lib/workers/backtestPerformanceClient'
import type { Trade } from '@/types/backtesting'

vi.mock('@/lib/workers/backtestPerformanceClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/workers/backtestPerformanceClient')>()
  return {
    ...actual,
    computeBacktestPerformance: vi.fn(actual.computeBacktestPerformance),
  }
})

function makeTrades(count: number, pnl = 100): Trade[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `t-${index}`,
    order_id: `o-${index}`,
    symbol: 'PETR4',
    action: 'BUY' as const,
    quantity: 100,
    entry_time: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    entry_price: 30,
    exit_time: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T16:00:00Z`,
    exit_price: 31,
    exit_reason: 'signal',
    pnl,
    commission: 0,
    point_value: 1,
    status: 'CLOSED' as const,
  }))
}

describe('useBacktestPerformanceData', () => {
  afterEach(() => {
    terminateBacktestPerformanceWorker()
    vi.mocked(computeBacktestPerformance).mockReset()
  })

  it('ignores stale async commits when trades change before the worker resolves', async () => {
    const tradesA = makeTrades(500, 100)
    const tradesB = makeTrades(500, 400)
    let resolveA: (value: BacktestPerformancePayload) => void = () => {}

    vi.mocked(computeBacktestPerformance).mockImplementation((trades, initialCapital) => {
      if (trades === tradesA) {
        return new Promise<BacktestPerformancePayload>((resolve) => {
          resolveA = resolve
        })
      }
      return Promise.resolve({
        equityCurve: buildEquityCurve(trades, initialCapital),
        monthlyStats: [],
      })
    })

    const { result, rerender } = renderHook(
      ({ trades, capital }: { trades: Trade[]; capital: number }) =>
        useBacktestPerformanceData(trades, capital),
      { initialProps: { trades: tradesA, capital: 100_000 } },
    )

    expect(result.current.computing).toBe(true)

    rerender({ trades: tradesB, capital: 200_000 })

    await waitFor(() => {
      expect(result.current.computing).toBe(false)
    })
    expect(result.current.equityCurve).toEqual(buildEquityCurve(tradesB, 200_000))

    resolveA({
      equityCurve: buildEquityCurve(tradesA, 100_000),
      monthlyStats: [],
    })

    await waitFor(() => {
      expect(result.current.equityCurve).toEqual(buildEquityCurve(tradesB, 200_000))
    })
  })
})
