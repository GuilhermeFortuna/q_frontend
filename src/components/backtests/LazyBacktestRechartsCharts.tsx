import { Fragment, lazy, Suspense, useState } from 'react'

import { FeatureIslandBoundary } from '@/components/islands/FeatureIslandBoundary'
import { FeatureIslandFallback } from '@/components/islands/FeatureIslandFallback'
import type { EquityPoint, MonthlyStats, Trade } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

const BacktestRechartsPane = lazy(() =>
  import('@/components/backtests/BacktestRechartsPane').then((module) => ({
    default: module.BacktestRechartsPane,
  })),
)

type LazyBacktestPerformanceChartsProps = {
  equityCurve: EquityPoint[]
  initialCapital: number
  bars: OhlcvBar[]
  trades: Trade[]
}

export function LazyBacktestPerformanceCharts({
  equityCurve,
  initialCapital,
  bars,
  trades,
}: LazyBacktestPerformanceChartsProps) {
  const [retryKey, setRetryKey] = useState(0)
  return (
    <FeatureIslandBoundary
      label="performance charts"
      resetKey={retryKey}
      onRetry={() => setRetryKey((k) => k + 1)}
    >
      <Fragment key={retryKey}>
        <Suspense
          fallback={<FeatureIslandFallback variant="pane" label="Loading performance charts" />}
        >
          <BacktestRechartsPane
            variant="performance"
            equityCurve={equityCurve}
            initialCapital={initialCapital}
            bars={bars}
            trades={trades}
          />
        </Suspense>
      </Fragment>
    </FeatureIslandBoundary>
  )
}

type LazyBacktestMonthlyChartProps = {
  monthlyStats: MonthlyStats[]
}

export function LazyBacktestMonthlyChart({ monthlyStats }: LazyBacktestMonthlyChartProps) {
  const [retryKey, setRetryKey] = useState(0)
  return (
    <FeatureIslandBoundary
      label="monthly chart"
      resetKey={retryKey}
      onRetry={() => setRetryKey((k) => k + 1)}
    >
      <Fragment key={retryKey}>
        <Suspense fallback={<FeatureIslandFallback variant="pane" label="Loading monthly chart" />}>
          <BacktestRechartsPane variant="monthly" monthlyStats={monthlyStats} />
        </Suspense>
      </Fragment>
    </FeatureIslandBoundary>
  )
}
