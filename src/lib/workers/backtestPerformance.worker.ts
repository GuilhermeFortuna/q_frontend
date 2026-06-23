import { aggregateMonthlyStats, buildEquityCurve } from '@/lib/backtesting/performance'
import type { Trade } from '@/types/backtesting'

type WorkerRequestEnvelope = {
  requestId: number
  trades: Trade[]
  initialCapital: number
}

type WorkerSuccessEnvelope = {
  requestId: number
  payload: {
    equityCurve: ReturnType<typeof buildEquityCurve>
    monthlyStats: ReturnType<typeof aggregateMonthlyStats>
  }
}

type WorkerErrorEnvelope = {
  requestId: number
  error: string
}

self.onmessage = (event: MessageEvent<WorkerRequestEnvelope>) => {
  const { requestId, trades, initialCapital } = event.data

  try {
    const payload: WorkerSuccessEnvelope['payload'] = {
      equityCurve: buildEquityCurve(trades, initialCapital),
      monthlyStats: aggregateMonthlyStats(trades),
    }
    const response: WorkerSuccessEnvelope = { requestId, payload }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerErrorEnvelope = {
      requestId,
      error: error instanceof Error ? error.message : 'Worker computation failed',
    }
    self.postMessage(response)
  }
}
