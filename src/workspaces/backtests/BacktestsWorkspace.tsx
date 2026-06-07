import axios from 'axios'
import { useMemo, useState } from 'react'

import { useRunBacktest } from '@/api/queries/backtests'
import { BacktestConfigForm } from '@/components/backtests/BacktestConfigForm'
import { BacktestResultsTabs } from '@/components/backtests/BacktestResultsTabs'
import { aggregateMonthlyStats, buildEquityCurve } from '@/lib/backtesting/performance'
import type { BacktestRequest } from '@/types/backtesting'

export function BacktestsWorkspace() {
  const runBacktest = useRunBacktest()
  const [lastCapital, setLastCapital] = useState(100000)
  const [lastRequest, setLastRequest] = useState<BacktestRequest | null>(null)

  const equityCurve = useMemo(() => {
    if (!runBacktest.data) return []
    return buildEquityCurve(runBacktest.data.trades, lastCapital)
  }, [runBacktest.data, lastCapital])

  const monthlyStats = useMemo(() => {
    if (!runBacktest.data) return []
    return aggregateMonthlyStats(runBacktest.data.trades)
  }, [runBacktest.data])

  const handleSubmit = (request: BacktestRequest) => {
    setLastCapital(request.initial_capital ?? 100000)
    setLastRequest(request)
    runBacktest.mutate(request)
  }

  const errorMessage = runBacktest.error
    ? axios.isAxiosError(runBacktest.error)
      ? ((runBacktest.error.response?.data as { detail?: string })?.detail ??
        runBacktest.error.message)
      : runBacktest.error instanceof Error
        ? runBacktest.error.message
        : 'Failed to run backtest'
    : null

  return (
    <div className="text-silver-100 flex min-h-[calc(100dvh-4.5rem-7rem)] w-full flex-col gap-4 overflow-hidden md:flex-row md:gap-6">
      <BacktestConfigForm
        loading={runBacktest.isPending}
        error={errorMessage}
        onSubmit={handleSubmit}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {runBacktest.isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex animate-pulse flex-col items-center">
              <div className="border-brass-500 mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
              <p className="text-silver-400">Simulating strategy over historical data...</p>
            </div>
          </div>
        ) : runBacktest.data ? (
          <BacktestResultsTabs
            results={runBacktest.data}
            initialCapital={lastCapital}
            equityCurve={equityCurve}
            monthlyStats={monthlyStats}
            symbol={lastRequest?.symbol ?? runBacktest.data.trades[0]?.symbol ?? '—'}
            timeframe={lastRequest?.timeframe ?? 'D1'}
          />
        ) : (
          <div className="border-carbon-600/60 flex flex-1 items-center justify-center rounded-xl border-2 border-dashed bg-transparent">
            <div className="text-center">
              <h3 className="text-silver-200 text-xl font-medium">No Results Yet</h3>
              <p className="text-silver-400 mt-2 max-w-sm text-sm">
                Configure your strategy parameters on the left and run a simulation to see the
                results.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
