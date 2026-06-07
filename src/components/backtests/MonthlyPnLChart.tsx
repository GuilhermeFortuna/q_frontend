import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CHART_COLORS, formatCurrency } from '@/components/backtests/chartUtils'
import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
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
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
          />
          <YAxis
            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCurrency(v)}
            width={72}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_COLORS.tooltipBg,
              border: `1px solid ${CHART_COLORS.tooltipBorder}`,
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: CHART_COLORS.axis }}
            formatter={(value: number) => [formatCurrency(value), 'PnL']}
          />
          <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.month}
                fill={entry.pnl >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
