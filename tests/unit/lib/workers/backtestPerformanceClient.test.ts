import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildEquityCurve, aggregateMonthlyStats } from '@/lib/backtesting/performance'
import {
  computeBacktestPerformance,
  terminateBacktestPerformanceWorker,
} from '@/lib/workers/backtestPerformanceClient'
import type { Trade } from '@/types/backtesting'

function makeTrades(count: number, pnl = 100): Trade[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `t-${index}`,
    order_id: `o-${index}`,
    symbol: 'PETR4',
    action: index % 2 === 0 ? 'BUY' : 'SELL',
    quantity: 100,
    entry_time: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    entry_price: 30,
    exit_time: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T16:00:00Z`,
    exit_price: 31,
    exit_reason: 'signal',
    pnl,
    commission: 0,
    point_value: 1,
    status: 'CLOSED',
  }))
}

type WorkerListener = (event: { data: unknown }) => void

class FakeWorker {
  static instances: FakeWorker[] = []

  onmessage: WorkerListener | null = null
  onerror: WorkerListener | null = null
  posted: unknown[] = []

  constructor() {
    FakeWorker.instances.push(this)
  }

  addEventListener(type: 'message' | 'error', listener: WorkerListener) {
    if (type === 'message') this.onmessage = listener
    if (type === 'error') this.onerror = listener
  }

  removeEventListener() {
    // no-op — client uses one shared listener per worker instance
  }

  postMessage(data: unknown) {
    this.posted.push(data)
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data })
  }

  emitError() {
    this.onerror?.({ data: null })
  }

  terminate() {
    const index = FakeWorker.instances.indexOf(this)
    if (index >= 0) FakeWorker.instances.splice(index, 1)
  }
}

describe('computeBacktestPerformance', () => {
  afterEach(() => {
    terminateBacktestPerformanceWorker()
    FakeWorker.instances = []
    vi.unstubAllGlobals()
  })

  it('computes on the main thread for small trade lists', async () => {
    const trades = makeTrades(10)
    const result = await computeBacktestPerformance(trades, 100_000)

    expect(result.equityCurve).toEqual(buildEquityCurve(trades, 100_000))
    expect(result.monthlyStats).toEqual(aggregateMonthlyStats(trades))
  })

  it('falls back to main thread when Worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined)

    const trades = makeTrades(500)
    const result = await computeBacktestPerformance(trades, 100_000)

    expect(result.equityCurve.length).toBe(500)
    expect(result.monthlyStats.length).toBeGreaterThan(0)
  })

  it('correlates out-of-order worker responses to the matching request', async () => {
    vi.stubGlobal('Worker', FakeWorker)

    const tradesA = makeTrades(500, 100)
    const tradesB = makeTrades(500, 250)

    const promiseA = computeBacktestPerformance(tradesA, 100_000)
    const promiseB = computeBacktestPerformance(tradesB, 200_000)

    const worker = FakeWorker.instances[0]
    expect(worker.posted).toHaveLength(2)
    expect(worker.posted[0]).toMatchObject({ requestId: 1, initialCapital: 100_000 })
    expect(worker.posted[1]).toMatchObject({ requestId: 2, initialCapital: 200_000 })

    worker.emitMessage({
      requestId: 2,
      payload: {
        equityCurve: buildEquityCurve(tradesB, 200_000),
        monthlyStats: aggregateMonthlyStats(tradesB),
      },
    })
    worker.emitMessage({
      requestId: 1,
      payload: {
        equityCurve: buildEquityCurve(tradesA, 100_000),
        monthlyStats: aggregateMonthlyStats(tradesA),
      },
    })

    const [resultA, resultB] = await Promise.all([promiseA, promiseB])

    expect(resultA.equityCurve).toEqual(buildEquityCurve(tradesA, 100_000))
    expect(resultB.equityCurve).toEqual(buildEquityCurve(tradesB, 200_000))
    expect(resultA.equityCurve[0]?.equity).not.toBe(resultB.equityCurve[0]?.equity)
  })

  it('falls back to main thread when worker posts an error envelope', async () => {
    vi.stubGlobal('Worker', FakeWorker)

    const trades = makeTrades(500)
    const promise = computeBacktestPerformance(trades, 100_000)
    const worker = FakeWorker.instances[0]

    worker.emitMessage({ requestId: 1, error: 'boom' })

    const result = await promise
    expect(result.equityCurve).toEqual(buildEquityCurve(trades, 100_000))
    expect(result.monthlyStats).toEqual(aggregateMonthlyStats(trades))
  })

  it('falls back pending requests when the worker emits an error event', async () => {
    vi.stubGlobal('Worker', FakeWorker)

    const tradesA = makeTrades(500, 100)
    const tradesB = makeTrades(500, 250)

    const promiseA = computeBacktestPerformance(tradesA, 100_000)
    const promiseB = computeBacktestPerformance(tradesB, 200_000)
    const worker = FakeWorker.instances[0]

    worker.emitError()

    const [resultA, resultB] = await Promise.all([promiseA, promiseB])
    expect(resultA.equityCurve).toEqual(buildEquityCurve(tradesA, 100_000))
    expect(resultB.equityCurve).toEqual(buildEquityCurve(tradesB, 200_000))
  })
})
