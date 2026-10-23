import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import { formatExitReason, formatSignedCurrency } from '@/components/backtests/chartUtils'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SegmentedToggle, type SegmentedOption } from '@/components/ui/SegmentedToggle'
import { formatHoldTime } from '@/lib/backtesting/backtestMetricFormatters'
import {
  breakdownBy,
  holdVsPnl,
  pnlHistogram,
  type BacktestDistributionData,
  type HistogramBin,
  type HoldVsPnlPoint,
  type TimeBreakdownBucket,
} from '@/lib/backtesting/distribution'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  chartMargin,
  ThemedCartesianGrid,
  themedTooltipCursor,
  themedXAxisProps,
  themedYAxisProps,
} from '@/lib/charts/rechartsTheme'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import type { BacktestPerformance, ExitReasonStats, Trade } from '@/types/backtesting'

export type TradeDistributionPanelsProps = {
  trades: Trade[]
  distribution?: BacktestDistributionData
  performance?: BacktestPerformance | null
  onFocusTrade?: (id: string) => void
  className?: string
}

// -----------------------------------------------------------------------------
// 1. P&L Distribution Histogram Panel
// -----------------------------------------------------------------------------

function HistogramTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: HistogramBin }>
}) {
  if (!active || !payload || !payload.length) return null
  const bin = payload[0]?.payload
  if (!bin) return null

  return (
    <div className={chartTheme.tooltip.shellClass}>
      <p className={chartTheme.tooltip.labelClass}>
        {formatSignedCurrency(bin.x0)} to {formatSignedCurrency(bin.x1)}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3 text-xs">
        <span className={chartTheme.tooltip.nameClass}>Trades</span>
        <span className={chartTheme.tooltip.valueClass}>
          {bin.count} ({(bin.share * 100).toFixed(1)}%)
        </span>
      </div>
    </div>
  )
}

function PnlDistributionPanel({
  bins,
  mean,
  median,
}: {
  bins: HistogramBin[]
  mean: number | null
  median: number | null
}) {
  const chartData = useMemo(
    () =>
      bins.map((bin) => ({
        ...bin,
        binLabel: `${bin.x0.toFixed(0)}`,
      })),
    [bins],
  )

  const meanBinLabel = useMemo(() => {
    if (mean == null || bins.length === 0) return null
    const found = bins.find((b, idx) => mean >= b.x0 && (mean < b.x1 || idx === bins.length - 1))
    return found ? `${found.x0.toFixed(0)}` : null
  }, [mean, bins])

  const medianBinLabel = useMemo(() => {
    if (median == null || bins.length === 0) return null
    const found = bins.find(
      (b, idx) => median >= b.x0 && (median < b.x1 || idx === bins.length - 1),
    )
    return found ? `${found.x0.toFixed(0)}` : null
  }, [median, bins])

  const headerRight = useMemo(() => {
    if (mean == null && median == null) return null
    return (
      <div className="text-silver-400 flex items-center gap-3 text-[11px] tabular-nums">
        {mean != null && (
          <span>
            Mean:{' '}
            <strong className="text-silver-200 font-mono">{formatSignedCurrency(mean)}</strong>
          </span>
        )}
        {median != null && (
          <span>
            Median:{' '}
            <strong className="text-silver-200 font-mono">{formatSignedCurrency(median)}</strong>
          </span>
        )}
      </div>
    )
  }, [mean, median])

  return (
    <div className="border-carbon-700/50 bg-carbon-900/35 space-y-3 rounded-xl border p-4">
      <SectionHeader title="P&L distribution" right={headerRight} />
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={chartMargin}>
            <ThemedCartesianGrid />
            <XAxis
              dataKey="binLabel"
              tickFormatter={(val) => formatSignedCurrency(Number(val))}
              {...themedXAxisProps}
            />
            <YAxis allowDecimals={false} {...themedYAxisProps} />
            <Tooltip cursor={themedTooltipCursor} content={<HistogramTooltip />} />

            {meanBinLabel ? (
              <ReferenceLine
                x={meanBinLabel}
                stroke="var(--color-gold-400)"
                strokeDasharray="3 3"
                label={{
                  value: 'Mean',
                  fill: 'var(--color-gold-400)',
                  fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />
            ) : null}

            {medianBinLabel && medianBinLabel !== meanBinLabel ? (
              <ReferenceLine
                x={medianBinLabel}
                stroke="var(--color-silver-300)"
                strokeDasharray="3 3"
                label={{
                  value: 'Median',
                  fill: 'var(--color-silver-300)',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            ) : null}

            <Bar dataKey="count" isAnimationActive={false}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`hist-cell-${index}`}
                  fill={
                    entry.tone === 'positive'
                      ? chartTheme.semantic.positive
                      : chartTheme.semantic.negative
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 2. Holding time vs P&L Scatter Panel
// -----------------------------------------------------------------------------

function HoldScatterTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: HoldVsPnlPoint }>
}) {
  if (!active || !payload || !payload.length) return null
  const pt = payload[0]?.payload
  if (!pt) return null

  return (
    <div className={chartTheme.tooltip.shellClass}>
      <p className="text-silver-400 font-mono text-[11px] font-semibold">Trade #{pt.id}</p>
      <div className="mt-1.5 space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>Side</span>
          <span
            className={cn(
              'font-semibold',
              pt.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            {pt.side}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>Entry</span>
          <span className={chartTheme.tooltip.valueClass}>
            {formatDisplayDateTime(pt.entryTime)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>Hold</span>
          <span className={chartTheme.tooltip.valueClass}>{formatHoldTime(pt.duration)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>P&L</span>
          <span
            className={cn(
              'font-mono font-bold',
              pt.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            {formatSignedCurrency(pt.pnl)}
          </span>
        </div>
      </div>
    </div>
  )
}

function HoldVsPnlPanel({
  points,
  onFocusTrade,
}: {
  points: HoldVsPnlPoint[]
  onFocusTrade?: (id: string) => void
}) {
  const [xMin, xMax, customTicks] = useMemo(() => {
    if (points.length === 0) return [1, 100, undefined]
    const durations = points.map((p) => Math.max(1, p.duration))
    const min = Math.min(...durations)
    const max = Math.max(...durations)
    if (min === max) {
      const lower = Math.max(1, Math.round(min * 0.5))
      const upper = Math.round(min * 2)
      return [lower, upper, [lower, min, upper]]
    }
    return [min, max, undefined]
  }, [points])

  // Clamp duration to minimum 1s for log scale
  const scatterData = useMemo(
    () =>
      points.map((pt) => ({
        ...pt,
        logDuration: Math.max(1, pt.duration),
      })),
    [points],
  )

  return (
    <div className="border-carbon-700/50 bg-carbon-900/35 space-y-3 rounded-xl border p-4">
      <SectionHeader title="Holding time vs P&L" />
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={chartMargin}>
            <ThemedCartesianGrid />
            <XAxis
              type="number"
              dataKey="logDuration"
              name="Hold"
              scale="log"
              domain={[xMin, xMax]}
              ticks={customTicks}
              tickFormatter={(v) => formatHoldTime(Number(v))}
              {...themedXAxisProps}
            />
            <YAxis
              type="number"
              dataKey="pnl"
              name="P&L"
              tickFormatter={formatSignedCurrency}
              {...themedYAxisProps}
            />
            <Tooltip cursor={themedTooltipCursor} content={<HoldScatterTooltip />} />
            <ReferenceLine
              y={0}
              stroke={chartTheme.semantic.reference}
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
            <Scatter
              data={scatterData}
              onClick={(point) => {
                const pt = point as unknown as { id?: string }
                if (pt?.id) onFocusTrade?.(pt.id)
              }}
              cursor="pointer"
              isAnimationActive={false}
            >
              {scatterData.map((entry, index) => (
                <Cell
                  key={entry.id || `scatter-cell-${index}`}
                  fill={
                    entry.pnl >= 0 ? chartTheme.semantic.positive : chartTheme.semantic.negative
                  }
                  fillOpacity={0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 3. By Exit Reason Panel
// -----------------------------------------------------------------------------

function ExitReasonTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ExitReasonStats & { label: string } }>
}) {
  if (!active || !payload || !payload.length) return null
  const item = payload[0]?.payload
  if (!item) return null

  return (
    <div className={chartTheme.tooltip.shellClass}>
      <p className="text-silver-200 font-semibold">{item.label}</p>
      <div className="mt-1.5 space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>P&L</span>
          <span
            className={cn(
              'font-mono font-bold',
              item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            {formatSignedCurrency(item.pnl)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>Trades</span>
          <span className={chartTheme.tooltip.valueClass}>{item.trades}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>Win rate</span>
          <span className={chartTheme.tooltip.valueClass}>{(item.win_rate * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

function ExitReasonPanel({ exitReasons }: { exitReasons: ExitReasonStats[] }) {
  const chartData = useMemo(
    () =>
      exitReasons.map((item) => ({
        ...item,
        label: formatExitReason(item.reason),
      })),
    [exitReasons],
  )

  return (
    <div className="border-carbon-700/50 bg-carbon-900/35 space-y-3 rounded-xl border p-4">
      <SectionHeader title="By exit reason" />
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart layout="vertical" data={chartData} margin={{ ...chartMargin, left: 32 }}>
            <ThemedCartesianGrid horizontal={false} />
            <XAxis type="number" tickFormatter={formatSignedCurrency} {...themedXAxisProps} />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tick={{ fontSize: 10, fill: 'var(--color-silver-300)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip cursor={themedTooltipCursor} content={<ExitReasonTooltip />} />
            <ReferenceLine
              x={0}
              stroke={chartTheme.semantic.reference}
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
            <Bar dataKey="pnl" isAnimationActive={false}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`exit-cell-${index}`}
                  fill={
                    entry.pnl >= 0 ? chartTheme.semantic.positive : chartTheme.semantic.negative
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 4. By Time Breakdown Panel
// -----------------------------------------------------------------------------

type TimeBreakdownMode = 'weekday' | 'hour'

const TIME_MODE_OPTIONS: SegmentedOption<TimeBreakdownMode>[] = [
  { value: 'weekday', label: 'Weekday' },
  { value: 'hour', label: 'Hour' },
]

function TimeTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: TimeBreakdownBucket }>
}) {
  if (!active || !payload || !payload.length) return null
  const bucket = payload[0]?.payload
  if (!bucket) return null

  return (
    <div className={chartTheme.tooltip.shellClass}>
      <p className="text-silver-200 font-semibold">{bucket.label}</p>
      <div className="mt-1.5 space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>Total P&L</span>
          <span
            className={cn(
              'font-mono font-bold',
              bucket.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            {formatSignedCurrency(bucket.pnl)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>Trades</span>
          <span className={chartTheme.tooltip.valueClass}>{bucket.trades}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className={chartTheme.tooltip.nameClass}>Win rate</span>
          <span className={chartTheme.tooltip.valueClass}>
            {(bucket.winRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

function TimeBreakdownPanel({
  weekdayData,
  hourData,
}: {
  weekdayData: TimeBreakdownBucket[]
  hourData: TimeBreakdownBucket[]
}) {
  const [mode, setMode] = useState<TimeBreakdownMode>('weekday')
  const data = mode === 'weekday' ? weekdayData : hourData

  return (
    <div className="border-carbon-700/50 bg-carbon-900/35 space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader title="By time" />
        <SegmentedToggle
          aria-label="Time breakdown mode"
          options={TIME_MODE_OPTIONS}
          value={mode}
          onChange={setMode}
        />
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={chartMargin}>
            <ThemedCartesianGrid />
            <XAxis dataKey="label" {...themedXAxisProps} />
            <YAxis
              yAxisId="pnl"
              orientation="left"
              tickFormatter={formatSignedCurrency}
              {...themedYAxisProps}
            />
            <YAxis
              yAxisId="winRate"
              orientation="right"
              domain={[0, 1]}
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
              {...themedYAxisProps}
            />
            <Tooltip cursor={themedTooltipCursor} content={<TimeTooltip />} />
            <ReferenceLine
              yAxisId="pnl"
              y={0}
              stroke={chartTheme.semantic.reference}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <Bar yAxisId="pnl" dataKey="pnl" isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell
                  key={`time-cell-${index}`}
                  fill={
                    entry.pnl >= 0 ? chartTheme.semantic.positive : chartTheme.semantic.negative
                  }
                />
              ))}
            </Bar>
            <Line
              yAxisId="winRate"
              type="monotone"
              dataKey="winRate"
              stroke="var(--color-gold-400)"
              strokeWidth={1.5}
              dot={{ r: 3, fill: 'var(--color-gold-400)' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main TradeDistributionPanels Component
// -----------------------------------------------------------------------------

export function TradeDistributionPanels({
  trades,
  distribution,
  performance,
  onFocusTrade,
  className,
}: TradeDistributionPanelsProps) {
  const closedTrades = useMemo(
    () => trades.filter((t) => t.status === 'CLOSED' && t.exit_time != null && t.pnl != null),
    [trades],
  )

  const histogramData = useMemo(
    () => distribution?.histogram ?? pnlHistogram(trades),
    [distribution, trades],
  )

  const holdVsPnlData = useMemo(
    () => distribution?.holdVsPnl ?? holdVsPnl(trades),
    [distribution, trades],
  )

  const weekdayData = useMemo(
    () => distribution?.byWeekday ?? breakdownBy(trades, 'weekday'),
    [distribution, trades],
  )

  const hourData = useMemo(
    () => distribution?.byHour ?? breakdownBy(trades, 'hour'),
    [distribution, trades],
  )

  if (closedTrades.length === 0) {
    return (
      <section
        aria-label="Trade distribution"
        className={cn(
          'border-carbon-700/50 bg-carbon-900/35 space-y-3 rounded-xl border p-4',
          className,
        )}
      >
        <SectionHeader title="Trade distribution" />
        <ChartEmptyState message="No closed trades recorded." />
      </section>
    )
  }

  const showExitReasons = Boolean(performance?.exit_reasons && performance.exit_reasons.length > 0)

  return (
    <section
      aria-label="Trade distribution"
      className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2', className)}
    >
      <PnlDistributionPanel
        bins={histogramData.bins}
        mean={histogramData.mean}
        median={histogramData.median}
      />
      <HoldVsPnlPanel points={holdVsPnlData} onFocusTrade={onFocusTrade} />
      {showExitReasons ? <ExitReasonPanel exitReasons={performance!.exit_reasons} /> : null}
      <TimeBreakdownPanel weekdayData={weekdayData} hourData={hourData} />
    </section>
  )
}
