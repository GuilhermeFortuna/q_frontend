import { aggregateMonthlyStats, buildEquityCurve } from '@/lib/backtesting/performance'
import { BACKTEST_WORKER_THRESHOLD } from '@/lib/virtualization/constants'
import type { EquityPoint, MonthlyStats, Trade } from '@/types/backtesting'

export type BacktestPerformancePayload = {
  equityCurve: EquityPoint[]
  monthlyStats: MonthlyStats[]
}

type WorkerRequestEnvelope = {
  requestId: number
  trades: Trade[]
  initialCapital: number
}

type WorkerSuccessEnvelope = {
  requestId: number
  payload: BacktestPerformancePayload
}

type WorkerErrorEnvelope = {
  requestId: number
  error: string
}

type WorkerResponseEnvelope = WorkerSuccessEnvelope | WorkerErrorEnvelope

type PendingRequest = {
  trades: Trade[]
  initialCapital: number
  resolve: (payload: BacktestPerformancePayload) => void
}

let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, PendingRequest>()

function isErrorEnvelope(envelope: WorkerResponseEnvelope): envelope is WorkerErrorEnvelope {
  return 'error' in envelope && typeof envelope.error === 'string'
}

function computeOnMainThread(trades: Trade[], initialCapital: number): BacktestPerformancePayload {
  return {
    equityCurve: buildEquityCurve(trades, initialCapital),
    monthlyStats: aggregateMonthlyStats(trades),
  }
}

function resolvePending(requestId: number, payload: BacktestPerformancePayload) {
  const entry = pending.get(requestId)
  if (!entry) return
  pending.delete(requestId)
  entry.resolve(payload)
}

function fallbackPending(requestId: number) {
  const entry = pending.get(requestId)
  if (!entry) return
  pending.delete(requestId)
  entry.resolve(computeOnMainThread(entry.trades, entry.initialCapital))
}

function fallbackAllPending() {
  for (const requestId of [...pending.keys()]) {
    fallbackPending(requestId)
  }
}

function onWorkerMessage(event: MessageEvent<WorkerResponseEnvelope>) {
  const envelope = event.data
  if (!envelope || typeof envelope.requestId !== 'number') return

  if (isErrorEnvelope(envelope)) {
    fallbackPending(envelope.requestId)
    return
  }

  resolvePending(envelope.requestId, envelope.payload)
}

function onWorkerError() {
  fallbackAllPending()
  worker?.terminate()
  worker = null
}

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!worker) {
    try {
      worker = new Worker(new URL('./backtestPerformance.worker.ts', import.meta.url), {
        type: 'module',
      })
      worker.addEventListener('message', onWorkerMessage)
      worker.addEventListener('error', onWorkerError)
    } catch {
      return null
    }
  }
  return worker
}

function runInWorker(trades: Trade[], initialCapital: number): Promise<BacktestPerformancePayload> {
  const instance = getWorker()
  if (!instance) {
    return Promise.resolve(computeOnMainThread(trades, initialCapital))
  }

  const requestId = nextRequestId++
  return new Promise((resolve) => {
    pending.set(requestId, { trades, initialCapital, resolve })
    const message: WorkerRequestEnvelope = { requestId, trades, initialCapital }
    instance.postMessage(message)
  })
}

/** Compute equity curve + monthly stats off the main thread for large trade lists. */
export async function computeBacktestPerformance(
  trades: Trade[],
  initialCapital: number,
): Promise<BacktestPerformancePayload> {
  if (trades.length < BACKTEST_WORKER_THRESHOLD) {
    return computeOnMainThread(trades, initialCapital)
  }
  return runInWorker(trades, initialCapital)
}

/** Test helper — terminate shared worker between tests. */
export function terminateBacktestPerformanceWorker(): void {
  fallbackAllPending()
  worker?.terminate()
  worker = null
  nextRequestId = 1
}
