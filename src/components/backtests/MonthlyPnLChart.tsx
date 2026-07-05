import { Bar, BarChart, Cell, ResponsiveContainer } from 'recharts'

import { formatCurrency } from '@/components/backtests/chartUtils'
import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  ThemedCartesianGrid,
  ThemedTooltip,
  ThemedXAxis,
  ThemedYAxis,
  chartMargin,
} from '@/lib/charts/rechartsTheme'
import type { MonthlyStats } from '@/types/backtesting'

type MonthlyPnLChartProps = {
  data: MonthlyStats[]
}

export function MonthlyPnLChart({ data }: MonthlyPnLChartProps) {
  if (data.length === 0) {
    return <ChartEmptyState message="No monthly data — run a backtest with closed trades." />
  }

  return (
    <div className="border-carbon-600/40 rounded-lg border bg-transparent p-4">
      <h4 className="text-silver-200 mb-3 text-sm font-medium">Monthly PnL</h4>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={chartMargin}>
          <ThemedCartesianGrid vertical={false} />
          <ThemedXAxis dataKey="label" />
          <ThemedYAxis tickFormatter={(v) => formatCurrency(v)} width={72} />
          <ThemedTooltip formatter={(value) => [formatCurrency(value), 'PnL']} />
          <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.month}
                fill={entry.pnl >= 0 ? chartTheme.semantic.positive : chartTheme.semantic.negative}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
