import { useState } from 'react'
import {
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

import {
  CURVE_X_MODE_OPTIONS,
  formatCurveXTick,
  timestampToX,
  toCurvePoints,
  type CurveXMode,
} from '@/components/backtests/curveAxis'
import { formatCurrency } from '@/components/backtests/chartUtils'
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
import type { DrawdownPeriod, EquityPoint, Trade } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

type YScale = 'linear' | 'log'

type EquityCurveChartProps = {
  data: EquityPoint[]
  initialCapital: number
  className?: string
  /** ISO timestamps for vertical window-boundary markers (e.g. OOS segment starts). */
  windowBoundaries?: string[]
  bars?: OhlcvBar[]
  trades?: Trade[]
  drawdowns?: DrawdownPeriod[]
  highlightedDrawdownIndex?: number | null
  syncId?: string
  xMode?: CurveXMode
  /** When provided, the X-axis toggle is shown and changes are reported here. */
  onXModeChange?: (mode: CurveXMode) => void
}

export function CustomEquityTooltip({
  active,
  payload,
  bars = [],
  trades = [],
}: {
  active?: boolean
  payload?: Array<{ payload: EquityPoint }>
  bars?: OhlcvBar[]
  trades?: Trade[]
}) {
  if (!active || !payload || !payload.length) return null

  const point = payload[0].payload as EquityPoint
  const timestamp = point.timestamp

  const bar = bars.find((b) => b.timestamp === timestamp)

  const pointTime = new Date(timestamp).getTime()
  const activeTrades = trades.filter((t) => {
    const entryTime = new Date(t.entry_time).getTime()
    const exitTime = t.exit_time ? new Date(t.exit_time).getTime() : Infinity
    return pointTime >= entryTime && pointTime < exitTime
  })

  return (
    <div className={cn(chartTheme.tooltip.shellClass, 'max-w-[240px] space-y-2')}>
      <div className="text-silver-400 font-mono text-[10px]">
        {new Date(timestamp).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-silver-300">Equity:</span>
          <span className="text-silver-100 font-mono font-bold tabular-nums">
            {formatCurrency(point.equity)}
          </span>
        </div>

        {point.pnl !== 0 && (
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-silver-300">PnL:</span>
            <span
              className={cn(
                'font-mono font-bold tabular-nums',
                point.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
              )}
            >
              {point.pnl >= 0 ? '+' : ''}
              {formatCurrency(point.pnl)}
            </span>
          </div>
        )}

        <div className="flex justify-between gap-4 text-xs">
          <span className="text-silver-300">Drawdown:</span>
          <span className="font-mono font-bold text-rose-400 tabular-nums">
            -{(point.drawdownPct * 100).toFixed(2)}%
          </span>
        </div>

        <div className="border-carbon-800/40 mt-1 flex justify-between gap-4 border-t pt-1 text-xs">
          <span className="text-silver-300">Open Trades:</span>
          <span className="text-brass-400 font-mono font-bold tabular-nums">
            {activeTrades.length}
          </span>
        </div>
      </div>

      {bar && (
        <div className="border-carbon-800/40 text-silver-400 space-y-0.5 border-t pt-1 font-mono text-[9px]">
          <div className="flex justify-between">
            <span>Bar O:</span>
            <span className="text-silver-200 tabular-nums">{formatCurrency(bar.open)}</span>
          </div>
          <div className="flex justify-between">
            <span>Bar C:</span>
            <span className="text-silver-200 tabular-nums">{formatCurrency(bar.close)}</span>
          </div>
        </div>
      )}

      {activeTrades.length > 0 && (
        <div className="border-carbon-800/40 max-h-[80px] space-y-1 overflow-y-auto border-t pt-1">
          <div className="text-brass-500 text-[8px] font-bold tracking-wider uppercase">
            Active Trades
          </div>
          {activeTrades.slice(0, 3).map((t) => (
            <div key={t.id} className="flex justify-between font-mono text-[8px] leading-tight">
              <span className={t.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                {t.action} {t.quantity}
              </span>
              <span className="text-silver-300 tabular-nums">{formatCurrency(t.entry_price)}</span>
            </div>
          ))}
          {activeTrades.length > 3 && (
            <div className="text-silver-500 text-right text-[7px] italic">
              + {activeTrades.length - 3} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function EquityCurveChart({
  data,
  initialCapital,
  className,
  windowBoundaries = [],
  bars = [],
  trades = [],
  drawdowns = [],
  highlightedDrawdownIndex = null,
  syncId,
  xMode = 'time',
  onXModeChange,
}: EquityCurveChartProps) {
  const [yScale, setYScale] = useState<YScale>('linear')

  if (data.length === 0) {
    return (
      <ChartEmptyState
        message="No equity data — run a backtest with closed trades."
        className={className}
      />
    )
  }

  const chartData = toCurvePoints(data, xMode)
  const equityValues = chartData.map((point) => point.equity)
  const minEquity = Math.min(...equityValues)
  const maxEquity = Math.max(...equityValues)
  const lastX = chartData[chartData.length - 1].x

  // A log axis cannot show zero or negative equity, so it is only offered for strictly positive curves.
  const logAvailable = minEquity > 0
  const activeYScale: YScale = yScale === 'log' && logAvailable ? 'log' : 'linear'
  const yScaleOptions: SegmentedOption<YScale>[] = [
    { value: 'linear', label: 'Linear' },
    { value: 'log', label: 'Log', disabled: !logAvailable },
  ]

  const periodBounds = (period: DrawdownPeriod) => ({
    x1: timestampToX(period.peak_time, data, xMode),
    x2: period.recovery_time ? timestampToX(period.recovery_time, data, xMode) : lastX,
  })
  const highlightedPeriod =
    highlightedDrawdownIndex != null ? drawdowns[highlightedDrawdownIndex] : undefined

  return (
    <div className={cn('border-carbon-600/40 rounded-lg border bg-transparent p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-silver-200 text-sm font-medium">Equity Curve</h4>
        <div className="flex flex-wrap items-center gap-2">
          {onXModeChange ? (
            <SegmentedToggle
              aria-label="Equity X axis"
              options={CURVE_X_MODE_OPTIONS}
              value={xMode}
              onChange={onXModeChange}
            />
          ) : null}
          <SegmentedToggle
            aria-label="Equity Y axis scale"
            options={yScaleOptions}
            value={activeYScale}
            onChange={setYScale}
          />
        </div>
      </div>
      <div className="w-full">
        <ResponsiveContainer width="100%" aspect={16 / 9}>
          <LineChart data={chartData} margin={chartMargin} syncId={syncId}>
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
              scale={activeYScale}
              domain={activeYScale === 'log' ? ['auto', 'auto'] : [0, 'auto']}
              allowDataOverflow={activeYScale === 'log'}
              tickFormatter={(v) => formatCurrency(v)}
              width={72}
            />
            <Tooltip
              cursor={themedTooltipCursor}
              content={<CustomEquityTooltip bars={bars} trades={trades} />}
            />
            {drawdowns.slice(0, 3).map((period, index) => (
              <ReferenceArea
                key={`worst-drawdown-${index}`}
                {...periodBounds(period)}
                y1={minEquity}
                y2={maxEquity}
                ifOverflow="extendDomain"
                fill={chartTheme.semantic.drawdown}
                fillOpacity={0.1}
                stroke="none"
              />
            ))}
            {highlightedPeriod ? (
              <ReferenceArea
                {...periodBounds(highlightedPeriod)}
                y1={minEquity}
                y2={maxEquity}
                ifOverflow="extendDomain"
                fill={chartTheme.semantic.drawdown}
                fillOpacity={0.24}
                stroke={chartTheme.semantic.drawdown}
                strokeOpacity={0.7}
              />
            ) : null}
            <ReferenceLine
              y={initialCapital}
              stroke={chartTheme.baseline.stroke}
              strokeDasharray={chartTheme.baseline.strokeDasharray}
              label={{
                value: 'Initial',
                fill: chartTheme.baseline.labelFill,
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
            {windowBoundaries.map((timestamp) => {
              const x = timestampToX(timestamp, data, xMode)
              return (
                <ReferenceLine
                  key={timestamp}
                  x={x}
                  stroke={chartTheme.semantic.reference}
                  strokeDasharray="2 4"
                  strokeOpacity={0.65}
                />
              )
            })}
            <Line
              type="monotone"
              dataKey="equity"
              stroke={chartTheme.semantic.equity}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: chartTheme.semantic.equity }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
