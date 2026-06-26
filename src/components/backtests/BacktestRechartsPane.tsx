import { DrawdownChart } from '@/components/backtests/DrawdownChart'
import { EquityCurveChart } from '@/components/backtests/EquityCurveChart'
import { MonthlyPnLChart } from '@/components/backtests/MonthlyPnLChart'
import type { EquityPoint, MonthlyStats, Trade } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

type BacktestRechartsPaneProps =
  | {
      variant: 'performance'
      equityCurve: EquityPoint[]
      initialCapital: number
      bars: OhlcvBar[]
      trades: Trade[]
      monthlyStats?: never
    }
  | {
      variant: 'monthly'
      monthlyStats: MonthlyStats[]
      equityCurve?: never
      initialCapital?: never
      bars?: never
      trades?: never
    }

export function BacktestRechartsPane(props: BacktestRechartsPaneProps) {
  if (props.variant === 'performance') {
    return (
      <div className="space-y-3">
        <EquityCurveChart
          key={`equity-${props.equityCurve.length}-${props.initialCapital}`}
          data={props.equityCurve}
          initialCapital={props.initialCapital}
          bars={props.bars}
          trades={props.trades}
        />
        <DrawdownChart key={`drawdown-${props.equityCurve.length}`} data={props.equityCurve} />
      </div>
    )
  }

  return <MonthlyPnLChart data={props.monthlyStats} />
}
