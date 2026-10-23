import { useState } from 'react'

import { DrawdownChart } from '@/components/backtests/DrawdownChart'
import { EquityCurveChart } from '@/components/backtests/EquityCurveChart'
import { MonthlyPnLChart } from '@/components/backtests/MonthlyPnLChart'
import { BacktestPerformanceSummary } from '@/components/backtests/BacktestPerformanceSummary'
import { WorstDrawdownsTable } from '@/components/backtests/WorstDrawdownsTable'
import { RollingMetricsChart } from '@/components/backtests/RollingMetricsChart'
import type { BacktestPerformance, EquityPoint, MonthlyStats, Trade } from '@/types/backtesting'
import type { BacktestDistributionData } from '@/lib/backtesting/distribution'
import type { OhlcvBar } from '@/types/api'

type BacktestRechartsPaneProps =
  | {
      variant: 'performance'
      equityCurve: EquityPoint[]
      initialCapital: number
      bars: OhlcvBar[]
      trades: Trade[]
      performance?: BacktestPerformance | null
      distribution?: BacktestDistributionData
      onFocusTrade?: (id: string) => void
      monthlyStats?: never
    }
  | {
      variant: 'monthly'
      monthlyStats: MonthlyStats[]
      equityCurve?: never
      initialCapital?: never
      bars?: never
      trades?: never
      distribution?: never
      onFocusTrade?: never
    }

export function BacktestRechartsPane(props: BacktestRechartsPaneProps) {
  const [highlightedDrawdownIndex, setHighlightedDrawdownIndex] = useState<number | null>(null)

  if (props.variant === 'performance') {
    return (
      <div className="space-y-3">
        {props.performance ? <BacktestPerformanceSummary performance={props.performance} /> : null}
        <div className="border-carbon-600/40 space-y-3 rounded-lg border bg-transparent p-4">
          <EquityCurveChart
            key={`equity-${props.equityCurve.length}-${props.initialCapital}`}
            data={props.equityCurve}
            initialCapital={props.initialCapital}
            bars={props.bars}
            trades={props.trades}
            drawdowns={props.performance?.drawdowns}
            highlightedDrawdownIndex={highlightedDrawdownIndex}
            syncId="backtest-performance"
            className="border-0 bg-transparent p-0"
          />
          <DrawdownChart
            key={`drawdown-${props.equityCurve.length}`}
            data={props.equityCurve}
            drawdowns={props.performance?.drawdowns}
            highlightedDrawdownIndex={highlightedDrawdownIndex}
            syncId="backtest-performance"
            className="border-0 bg-transparent p-0"
          />
        </div>
        {props.performance ? (
          <WorstDrawdownsTable
            drawdowns={props.performance.drawdowns}
            highlightedIndex={highlightedDrawdownIndex}
            onHighlight={setHighlightedDrawdownIndex}
          />
        ) : null}
        <RollingMetricsChart
          trades={props.trades}
          distribution={props.distribution}
          performance={props.performance}
        />
      </div>
    )
  }

  return <MonthlyPnLChart data={props.monthlyStats} />
}
