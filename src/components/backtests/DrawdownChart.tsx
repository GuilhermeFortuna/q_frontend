import { Area, AreaChart, ReferenceArea, ResponsiveContainer } from 'recharts'

import { formatChartDate } from '@/components/backtests/chartUtils'
import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import { cn } from '@/lib/utils'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  ThemedCartesianGrid,
  ThemedTooltip,
  ThemedXAxis,
  ThemedYAxis,
  chartMargin,
} from '@/lib/charts/rechartsTheme'
import type { DrawdownPeriod, EquityPoint } from '@/types/backtesting'

const DRAWDOWN_CHART_HEIGHT_PX = 200

type DrawdownChartProps = {
  data: EquityPoint[]
  className?: string
  drawdowns?: DrawdownPeriod[]
  highlightedDrawdownIndex?: number | null
  syncId?: string
}

export function DrawdownChart({
  data,
  className,
  drawdowns = [],
  highlightedDrawdownIndex = null,
  syncId,
}: DrawdownChartProps) {
  if (data.length === 0) {
    return <ChartEmptyState message="No drawdown data available." className={className} />
  }

  const chartData = data.map((point) => ({
    ...point,
    label: formatChartDate(point.timestamp),
    drawdownPctNeg: -(point.drawdownPct * 100),
  }))
  const drawdownValues = chartData.map((point) => point.drawdownPctNeg)

  return (
    <div className={cn('border-carbon-600/40 rounded-lg border bg-transparent p-4', className)}>
      <h4 className="text-silver-200 mb-3 text-sm font-medium">Drawdown</h4>
      <div className="w-full" style={{ height: DRAWDOWN_CHART_HEIGHT_PX }}>
        <ResponsiveContainer width="100%" height={DRAWDOWN_CHART_HEIGHT_PX}>
          <AreaChart data={chartData} margin={chartMargin} syncId={syncId}>
            <ThemedCartesianGrid vertical={false} />
            <ThemedXAxis dataKey="label" minTickGap={40} />
            <ThemedYAxis tickFormatter={(v) => `${v.toFixed(1)}%`} width={48} />
            <ThemedTooltip formatter={(value) => [`${Math.abs(value).toFixed(2)}%`, 'Drawdown']} />
            {highlightedDrawdownIndex != null && drawdowns[highlightedDrawdownIndex] ? (
              <ReferenceArea
                x1={formatChartDate(drawdowns[highlightedDrawdownIndex].peak_time)}
                x2={
                  drawdowns[highlightedDrawdownIndex].recovery_time
                    ? formatChartDate(drawdowns[highlightedDrawdownIndex].recovery_time!)
                    : chartData[chartData.length - 1]?.label
                }
                y1={Math.min(...drawdownValues)}
                y2={Math.max(...drawdownValues)}
                ifOverflow="extendDomain"
                fill={chartTheme.semantic.drawdown}
                fillOpacity={0.24}
                stroke={chartTheme.semantic.drawdown}
                strokeOpacity={0.7}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="drawdownPctNeg"
              stroke={chartTheme.semantic.drawdown}
              fill={chartTheme.semantic.drawdown}
              fillOpacity={0.25}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
