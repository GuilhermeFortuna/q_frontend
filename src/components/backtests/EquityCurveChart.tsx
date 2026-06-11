import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CHART_COLORS, formatChartDate, formatCurrency } from '@/components/backtests/chartUtils'
import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import { cn } from '@/lib/utils'
import type { EquityPoint } from '@/types/backtesting'

type EquityCurveChartProps = {
  data: EquityPoint[]
  initialCapital: number
  className?: string
  fillHeight?: boolean
  /** ISO timestamps for vertical window-boundary markers (e.g. OOS segment starts). */
  windowBoundaries?: string[]
}

export function EquityCurveChart({
  data,
  initialCapital,
  className,
  fillHeight = false,
  windowBoundaries = [],
}: EquityCurveChartProps) {
  if (data.length === 0) {
    return (
      <ChartEmptyState
        message="No equity data — run a backtest with closed trades."
        className={cn(fillHeight && 'min-h-[180px] flex-1', className)}
      />
    )
  }

  const chartData = data.map((point) => ({
    ...point,
    label: formatChartDate(point.timestamp),
  }))

  const boundaryLabels = windowBoundaries.map((timestamp) => formatChartDate(timestamp))

  return (
    <div
      className={cn(
        'border-carbon-600/40 flex min-h-0 flex-col rounded-lg border bg-transparent p-4',
        fillHeight && 'flex-1',
        className,
      )}
    >
      <h4 className="text-silver-200 mb-3 shrink-0 text-sm font-medium">Equity Curve</h4>
      <div className={cn('w-full', fillHeight ? 'min-h-[180px] flex-1' : 'h-[260px]')}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
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
              formatter={(value: number, name: string) => {
                if (name === 'equity') return [formatCurrency(value), 'Equity']
                if (name === 'pnl') return [formatCurrency(value), 'Trade PnL']
                return [value, name]
              }}
            />
            <ReferenceLine
              y={initialCapital}
              stroke={CHART_COLORS.reference}
              strokeDasharray="4 4"
              label={{
                value: 'Initial',
                fill: CHART_COLORS.reference,
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
            {boundaryLabels.map((label) => (
              <ReferenceLine
                key={label}
                x={label}
                stroke={CHART_COLORS.reference}
                strokeDasharray="2 4"
                strokeOpacity={0.65}
              />
            ))}
            <Line
              type="monotone"
              dataKey="equity"
              stroke={CHART_COLORS.equity}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.equity }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
