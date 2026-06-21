import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CHART_COLORS, formatChartDate } from '@/components/backtests/chartUtils'
import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import { cn } from '@/lib/utils'
import type { EquityPoint } from '@/types/backtesting'

const DRAWDOWN_CHART_HEIGHT_PX = 200

type DrawdownChartProps = {
  data: EquityPoint[]
  className?: string
}

export function DrawdownChart({ data, className }: DrawdownChartProps) {
  if (data.length === 0) {
    return <ChartEmptyState message="No drawdown data available." className={className} />
  }

  const chartData = data.map((point) => ({
    ...point,
    label: formatChartDate(point.timestamp),
    drawdownPctNeg: -(point.drawdownPct * 100),
  }))

  return (
    <div className={cn('border-carbon-600/40 rounded-lg border bg-transparent p-4', className)}>
      <h4 className="text-silver-200 mb-3 text-sm font-medium">Drawdown</h4>
      <div className="w-full" style={{ height: DRAWDOWN_CHART_HEIGHT_PX }}>
        <ResponsiveContainer width="100%" height={DRAWDOWN_CHART_HEIGHT_PX}>
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              width={48}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_COLORS.tooltipBg,
                border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: CHART_COLORS.axis }}
              formatter={(value: number) => [`${Math.abs(value).toFixed(2)}%`, 'Drawdown']}
            />
            <Area
              type="monotone"
              dataKey="drawdownPctNeg"
              stroke={CHART_COLORS.drawdown}
              fill={CHART_COLORS.drawdown}
              fillOpacity={0.25}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
