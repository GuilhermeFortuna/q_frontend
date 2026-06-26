import { lazy, Suspense } from 'react'

import { FeatureIslandFallback } from '@/components/islands/FeatureIslandFallback'
import type { ChartIndicatorSeries, Trade } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

const BacktestStrategyChart = lazy(() =>
  import('@/components/backtests/BacktestStrategyChart').then((module) => ({
    default: module.BacktestStrategyChart,
  })),
)

type LazyBacktestStrategyChartProps = {
  bars: OhlcvBar[]
  indicators: ChartIndicatorSeries[]
  trades: Trade[]
  symbol: string
  timeframe: string
  runId?: string
  focusedTradeId?: string | null
  hoveredTradeId?: string | null
  onHoverTradeChange?: (id: string | null) => void
}

export function LazyBacktestStrategyChart(props: LazyBacktestStrategyChartProps) {
  return (
    <Suspense fallback={<FeatureIslandFallback variant="pane" label="Loading trade chart" />}>
      <BacktestStrategyChart {...props} />
    </Suspense>
  )
}
