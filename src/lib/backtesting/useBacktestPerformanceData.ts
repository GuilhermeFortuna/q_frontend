import { useEffect, useMemo, useRef, useState } from 'react'

import { aggregateMonthlyStats, buildEquityCurve } from '@/lib/backtesting/performance'
import { computeBacktestPerformance } from '@/lib/workers/backtestPerformanceClient'
import { BACKTEST_WORKER_THRESHOLD } from '@/lib/virtualization/constants'
import type { EquityPoint, MonthlyStats, Trade } from '@/types/backtesting'

type BacktestPerformanceData = {
  equityCurve: EquityPoint[]
  monthlyStats: MonthlyStats[]
  computing: boolean
}

const EMPTY: BacktestPerformanceData = {
  equityCurve: [],
  monthlyStats: [],
  computing: false,
}

export function useBacktestPerformanceData(
  trades: Trade[] | undefined,
  initialCapital: number,
): BacktestPerformanceData {
  const syncResult = useMemo(() => {
    if (!trades || trades.length === 0) return EMPTY
    if (trades.length >= BACKTEST_WORKER_THRESHOLD) return null
    return {
      equityCurve: buildEquityCurve(trades, initialCapital),
      monthlyStats: aggregateMonthlyStats(trades),
      computing: false,
    }
  }, [trades, initialCapital])

  const [asyncResult, setAsyncResult] = useState<BacktestPerformanceData | null>(null)
  const requestSequence = useRef(0)

  useEffect(() => {
    if (!trades || trades.length < BACKTEST_WORKER_THRESHOLD) {
      setAsyncResult(null)
      return
    }

    let cancelled = false
    const sequence = ++requestSequence.current
    setAsyncResult({ equityCurve: [], monthlyStats: [], computing: true })

    void computeBacktestPerformance(trades, initialCapital).then((payload) => {
      if (cancelled) return
      if (sequence !== requestSequence.current) return
      setAsyncResult({
        equityCurve: payload.equityCurve,
        monthlyStats: payload.monthlyStats,
        computing: false,
      })
    })

    return () => {
      cancelled = true
    }
  }, [trades, initialCapital])

  if (!trades || trades.length === 0) return EMPTY
  if (syncResult) return syncResult
  return asyncResult ?? { equityCurve: [], monthlyStats: [], computing: true }
}
