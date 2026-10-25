import { useState } from 'react'
import { Area, AreaChart, ReferenceArea, ResponsiveContainer, Tooltip } from 'recharts'

import {
  formatCurveXTick,
  timestampToX,
  toCurvePoints,
  type CurveXMode,
  type CurvePoint,
} from '@/components/backtests/curveAxis'
import { formatChartDate, formatCurrency } from '@/components/backtests/chartUtils'
import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import { SegmentedToggle, type SegmentedOption } from '@/components/ui/SegmentedToggle'
import { cn } from '@/lib/utils'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  ThemedCartesianGrid,
  ThemedXAxis,
  ThemedYAxis,
  chartMargin,
  themedTooltipCursor,
} from '@/lib/charts/rechartsTheme'
import type { DrawdownPeriod, EquityPoint } from '@/types/backtesting'

const DRAWDOWN_CHART_HEIGHT_PX = 200

type DrawdownUnit = 'pct' | 'value'

const DRAWDOWN_UNIT_OPTIONS: SegmentedOption<DrawdownUnit>[] = [
  { value: 'pct', label: '%' },
  { value: 'value', label: 'Value' },
]

type DrawdownChartProps = {
  data: EquityPoint[]
  className?: string
  drawdowns?: DrawdownPeriod[]
  highlightedDrawdownIndex?: number | null
  syncId?: string
  xMode?: CurveXMode
}

/** Worst period containing the hovered point, if the point is underwater. */
function findContainingPeriod(point: CurvePoint, drawdowns: DrawdownPeriod[]) {
  if (point.drawdown <= 0) return undefined
  const time = new Date(point.timestamp).getTime()
  return drawdowns.find((period) => {
    const peak = new Date(period.peak_time).getTime()
    const recovery = period.recovery_time ? new Date(period.recovery_time).getTime() : Infinity
    return time >= peak && time < recovery
  })
}

export function CustomDrawdownTooltip({
  active,
  payload,
  drawdowns = [],
}: {
  active?: boolean
  payload?: Array<{ payload: CurvePoint }>
  drawdowns?: DrawdownPeriod[]
}) {
  if (!active || !payload || !payload.length) return null

  const point = payload[0].payload
  const period = findContainingPeriod(point, drawdowns)

  return (
    <div className={cn(chartTheme.tooltip.shellClass, 'max-w-[240px] space-y-2')}>
      <div className="text-silver-400 font-mono text-[10px]">
        {new Date(point.timestamp).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-silver-300">Drawdown:</span>
          <span className="font-mono font-bold text-rose-400 tabular-nums">
            -{(point.drawdownPct * 100).toFixed(2)}%
          </span>
        </div>

        <div className="flex justify-between gap-4 text-xs">
          <span className="text-silver-300">Value:</span>
          <span className="font-mono font-bold text-rose-400 tabular-nums">
            -{formatCurrency(point.drawdown)}
          </span>
        </div>

        <div className="border-carbon-800/40 mt-1 flex justify-between gap-4 border-t pt-1 text-xs">
          <span className="text-silver-300">Equity:</span>
          <span className="text-silver-100 font-mono font-bold tabular-nums">
            {formatCurrency(point.equity)}
          </span>
        </div>
      </div>

      {period && (
        <div className="border-carbon-800/40 space-y-1 border-t pt-1">
          <div className="text-brass-500 text-[8px] font-bold tracking-wider uppercase">
            Drawdown period
          </div>
          <div className="text-silver-300 font-mono text-[9px] leading-tight">
            {`${formatChartDate(period.peak_time)} → ${
              period.recovery_time ? formatChartDate(period.recovery_time) : 'ongoing'
            }`}
          </div>
          <div className="flex justify-between font-mono text-[9px]">
            <span className="text-silver-400">Depth:</span>
            <span className="text-silver-200 tabular-nums">
              -{(period.depth_pct * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between font-mono text-[9px]">
            <span className="text-silver-400">Duration:</span>
            <span className="text-silver-200 tabular-nums">{period.duration_days}d</span>
          </div>
          <div className="flex justify-between font-mono text-[9px]">
            <span className="text-silver-400">Trades:</span>
            <span className="text-silver-200 tabular-nums">{period.trades}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function DrawdownChart({
  data,
  className,
  drawdowns = [],
  highlightedDrawdownIndex = null,
  syncId,
  xMode = 'time',
}: DrawdownChartProps) {
  const [unit, setUnit] = useState<DrawdownUnit>('pct')
  // The area draws once per mount; later re-renders and resizes update it without replaying the draw.
  const [hasDrawn, setHasDrawn] = useState(false)

  if (data.length === 0) {
    return <ChartEmptyState message="No drawdown data available." className={className} />
  }

  const chartData = toCurvePoints(data, xMode).map((point) => ({
    ...point,
    drawdownPctNeg: -(point.drawdownPct * 100),
    drawdownValueNeg: -point.drawdown,
  }))
  const valueKey = unit === 'pct' ? 'drawdownPctNeg' : 'drawdownValueNeg'
  const drawdownValues = chartData.map((point) => point[valueKey])
  const lastX = chartData[chartData.length - 1].x
  const highlightedPeriod =
    highlightedDrawdownIndex != null ? drawdowns[highlightedDrawdownIndex] : undefined

  return (
    <div className={cn('border-carbon-600/40 rounded-lg border bg-transparent p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-silver-200 text-sm font-medium">Drawdown</h4>
        <SegmentedToggle
          aria-label="Drawdown unit"
          options={DRAWDOWN_UNIT_OPTIONS}
          value={unit}
          onChange={setUnit}
        />
      </div>
      <div className="w-full" style={{ height: DRAWDOWN_CHART_HEIGHT_PX }}>
        <ResponsiveContainer width="100%" height={DRAWDOWN_CHART_HEIGHT_PX}>
          <AreaChart data={chartData} margin={chartMargin} syncId={syncId}>
            <ThemedCartesianGrid vertical={false} />
            <ThemedXAxis
              type="number"
              dataKey="x"
              domain={['dataMin', 'dataMax']}
              scale={xMode === 'time' ? 'time' : 'auto'}
              allowDecimals={xMode === 'time'}
              tickFormatter={formatCurveXTick(xMode)}
              minTickGap={40}
            />
            <ThemedYAxis
              tickFormatter={(v) => (unit === 'pct' ? `${v.toFixed(1)}%` : formatCurrency(v))}
              width={unit === 'pct' ? 48 : 72}
            />
            <Tooltip
              cursor={themedTooltipCursor}
              content={<CustomDrawdownTooltip drawdowns={drawdowns} />}
            />
            {highlightedPeriod ? (
              <ReferenceArea
                x1={timestampToX(highlightedPeriod.peak_time, data, xMode)}
                x2={
                  highlightedPeriod.recovery_time
                    ? timestampToX(highlightedPeriod.recovery_time, data, xMode)
                    : lastX
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
              dataKey={valueKey}
              stroke={chartTheme.semantic.drawdown}
              fill={chartTheme.semantic.drawdown}
              fillOpacity={0.25}
              strokeWidth={1.5}
              isAnimationActive={!hasDrawn}
              onAnimationEnd={() => setHasDrawn(true)}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
