import { lazy, Suspense } from 'react'

import { FeatureIslandFallback } from '@/components/islands/FeatureIslandFallback'
import type { EquityPoint, MonthlyStats } from '@/types/backtesting'

const BacktestRechartsPane = lazy(() =>
  import('@/components/backtests/BacktestRechartsPane').then((module) => ({
    default: module.BacktestRechartsPane,
  })),
)

type LazyBacktestPerformanceChartsProps = {
  equityCurve: EquityPoint[]
  initialCapital: number
}

export function LazyBacktestPerformanceCharts({
  equityCurve,
  initialCapital,
}: LazyBacktestPerformanceChartsProps) {
  return (
    <Suspense
      fallback={<FeatureIslandFallback variant="pane" label="Loading performance charts" />}
    >
      <BacktestRechartsPane
        variant="performance"
        equityCurve={equityCurve}
        initialCapital={initialCapital}
      />
    </Suspense>
  )
}

type LazyBacktestMonthlyChartProps = {
  monthlyStats: MonthlyStats[]
}

export function LazyBacktestMonthlyChart({ monthlyStats }: LazyBacktestMonthlyChartProps) {
  return (
    <Suspense fallback={<FeatureIslandFallback variant="pane" label="Loading monthly chart" />}>
      <BacktestRechartsPane variant="monthly" monthlyStats={monthlyStats} />
    </Suspense>
  )
}
