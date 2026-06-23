import { DrawdownChart } from '@/components/backtests/DrawdownChart'
import { EquityCurveChart } from '@/components/backtests/EquityCurveChart'
import { MonthlyPnLChart } from '@/components/backtests/MonthlyPnLChart'
import type { EquityPoint, MonthlyStats } from '@/types/backtesting'

type BacktestRechartsPaneProps =
  | {
      variant: 'performance'
      equityCurve: EquityPoint[]
      initialCapital: number
      monthlyStats?: never
    }
  | {
      variant: 'monthly'
      monthlyStats: MonthlyStats[]
      equityCurve?: never
      initialCapital?: never
    }

export function BacktestRechartsPane(props: BacktestRechartsPaneProps) {
  if (props.variant === 'performance') {
    return (
      <div className="space-y-3">
        <EquityCurveChart
          key={`equity-${props.equityCurve.length}-${props.initialCapital}`}
          data={props.equityCurve}
          initialCapital={props.initialCapital}
        />
        <DrawdownChart key={`drawdown-${props.equityCurve.length}`} data={props.equityCurve} />
      </div>
    )
  }

  return <MonthlyPnLChart data={props.monthlyStats} />
}
