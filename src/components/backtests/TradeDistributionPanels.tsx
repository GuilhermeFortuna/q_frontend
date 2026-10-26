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
import { formatCurrency } from '@/components/backtests/chartUtils'
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
import type { BacktestPerformance, ReasonStats, Trade } from '@/types/backtesting'
import type { PostExitAnalysis } from '@/types/backtesting'

export type TradeDistributionPanelsProps = {
  trades: Trade[]
  distribution?: BacktestDistributionData
  performance?: BacktestPerformance | null
  onFocusTrade?: (id: string) => void
  className?: string
  postExitBars?: number
  storedPostExitBars?: number
  postExitAnalysis?: PostExitAnalysis
  postExitLoading?: boolean
  postExitError?: string | null
  onPostExitBarsChange?: (bars: number) => void
  onPostExitReset?: () => void
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
// 3. By Reason Panel (entry or exit reasons)
// -----------------------------------------------------------------------------

type ReasonKind = 'entry' | 'exit'

const REASON_KIND_OPTIONS: SegmentedOption<ReasonKind>[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'exit', label: 'Exit' },
]

function ReasonTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ReasonStats & { label: string } }>
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

function ReasonPanel({
  entryReasons,
  exitReasons,
}: {
  entryReasons: ReasonStats[]
  exitReasons: ReasonStats[]
}) {
  const [kind, setKind] = useState<ReasonKind>('exit')
  const reasons = kind === 'entry' ? entryReasons : exitReasons
  const chartData = useMemo(
    () =>
      reasons.map((item) => ({
        ...item,
        label: formatExitReason(item.reason),
      })),
    [reasons],
  )

  return (
    <div className="border-carbon-700/50 bg-carbon-900/35 space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader title="By reason" />
        <SegmentedToggle
          aria-label="Reason kind"
          options={REASON_KIND_OPTIONS}
          value={kind}
          onChange={setKind}
        />
      </div>
      {chartData.length === 0 ? (
        <ChartEmptyState
          message={kind === 'entry' ? 'No entry reasons recorded.' : 'No exit reasons recorded.'}
        />
      ) : (
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
              <Tooltip cursor={themedTooltipCursor} content={<ReasonTooltip />} />
              <ReferenceLine
                x={0}
                stroke={chartTheme.semantic.reference}
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />
              <Bar dataKey="pnl" isAnimationActive={false}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`${kind}-cell-${index}`}
                    fill={
                      entry.pnl >= 0 ? chartTheme.semantic.positive : chartTheme.semantic.negative
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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
  postExitBars,
  storedPostExitBars,
  postExitAnalysis,
  postExitLoading,
  postExitError,
  onPostExitBarsChange,
  onPostExitReset,
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

  const entryReasons = performance?.entry_reasons ?? []
  const exitReasons = performance?.exit_reasons ?? []
  const showReasons = entryReasons.length > 0 || exitReasons.length > 0
  const excursionStats = performance?.trades?.all
  const resolution = performance?.excursions?.resolution
  const hasApproximateResolution = Boolean(
    resolution && (resolution.minute > 0 || resolution.candle > 0),
  )

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
      {showReasons ? <ReasonPanel entryReasons={entryReasons} exitReasons={exitReasons} /> : null}
      <TimeBreakdownPanel weekdayData={weekdayData} hourData={hourData} />
      {excursionStats && excursionStats.excursion_trades > 0 && performance?.excursions ? (
        <TradeExcursionsPanel
          trades={closedTrades}
          performance={performance}
          postExitBars={postExitBars ?? performance.excursions.post_exit_bars}
          storedPostExitBars={storedPostExitBars ?? performance.excursions.post_exit_bars}
          postExitAnalysis={postExitAnalysis}
          postExitLoading={postExitLoading}
          postExitError={postExitError}
          onPostExitBarsChange={onPostExitBarsChange}
          onPostExitReset={onPostExitReset}
          showResolutionNote={hasApproximateResolution}
        />
      ) : null}
    </section>
  )
}

const EXCURSION_SIDES: SegmentedOption<'all' | 'long' | 'short'>[] = [
  { value: 'all', label: 'All' },
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
]

function TradeExcursionsPanel({
  trades,
  performance,
  postExitBars,
  storedPostExitBars,
  postExitAnalysis,
  postExitLoading,
  postExitError,
  onPostExitBarsChange,
  onPostExitReset,
  showResolutionNote,
}: {
  trades: Trade[]
  performance: BacktestPerformance
  postExitBars: number
  storedPostExitBars: number
  postExitAnalysis?: PostExitAnalysis
  postExitLoading?: boolean
  postExitError?: string | null
  onPostExitBarsChange?: (bars: number) => void
  onPostExitReset?: () => void
  showResolutionNote: boolean
}) {
  const [side, setSide] = useState<'all' | 'long' | 'short'>('all')
  const stats = performance.trades[side]
  const dynamicPostExit = postExitAnalysis?.[side]
  const postExitReturn = dynamicPostExit?.avg_post_exit_return ?? stats.avg_post_exit_return
  const continuation =
    dynamicPostExit?.post_exit_continuation_rate ?? stats.post_exit_continuation_rate
  const scatterData = (key: 'mfe_points' | 'mae_points') => {
    const points = trades.flatMap((trade) => {
      const value = trade[key]
      if (value == null || trade.pnl == null) return []
      return [{ id: trade.id, x: value * trade.quantity * trade.point_value, y: trade.pnl }]
    })
    return {
      winners: points.filter((point) => point.y > 0),
      losers: points.filter((point) => point.y <= 0),
    }
  }
  const mfe = scatterData('mfe_points')
  const mae = scatterData('mae_points')

  return (
    <section
      aria-label="Trade excursions"
      className="border-carbon-700/50 bg-carbon-900/35 space-y-3 rounded-xl border p-4 lg:col-span-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Trade excursions" />
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="post-exit-bars" className="text-silver-300">
            Post-exit bars
          </label>
          <input
            id="post-exit-bars"
            aria-label="Post-exit bars"
            type="number"
            min={1}
            max={500}
            value={postExitBars}
            onChange={(event) => onPostExitBarsChange?.(Number(event.target.value))}
            className="border-carbon-600 bg-carbon-950 text-silver-100 focus:border-brass-400 w-20 rounded-md border px-2 py-1 font-mono focus:outline-none"
          />
          {postExitBars !== storedPostExitBars ? (
            <button
              type="button"
              onClick={onPostExitReset}
              className="text-brass-300 hover:text-brass-200 underline underline-offset-2"
            >
              Reset
            </button>
          ) : null}
          {postExitLoading ? (
            <span role="status" className="text-silver-400">
              Updating…
            </span>
          ) : null}
        </div>
      </div>
      {postExitError ? (
        <p role="alert" className="text-xs text-rose-400">
          {postExitError}
        </p>
      ) : null}
      <SegmentedToggle
        options={EXCURSION_SIDES}
        value={side}
        onChange={setSide}
        aria-label="Excursion trade side"
      />
      <div className="text-silver-300 grid grid-cols-2 gap-x-5 gap-y-2 text-xs md:grid-cols-4">
        <p>
          Trades <span className="text-silver-100 font-mono">{stats.excursion_trades}</span>
        </p>
        <p>
          Avg MFE{' '}
          <span className="text-silver-100 font-mono">
            {stats.avg_mfe == null ? '—' : formatCurrency(stats.avg_mfe)}
          </span>
        </p>
        <p>
          Avg MAE{' '}
          <span className="text-silver-100 font-mono">
            {stats.avg_mae == null ? '—' : formatCurrency(stats.avg_mae)}
          </span>
        </p>
        <p>
          Capture{' '}
          <span className="text-silver-100 font-mono">
            {stats.mfe_capture == null ? '—' : `${(stats.mfe_capture * 100).toFixed(1)}%`}
          </span>
        </p>
        <p>
          Median capture{' '}
          <span className="text-silver-100 font-mono">
            {stats.median_mfe_capture == null
              ? '—'
              : `${(stats.median_mfe_capture * 100).toFixed(1)}%`}
          </span>
        </p>
        <p>
          Median time to MFE{' '}
          <span className="text-silver-100 font-mono">
            {formatHoldTime(stats.median_time_to_mfe_seconds)}
          </span>
        </p>
        <p>
          Avg post-exit{' '}
          <span className="text-silver-100 font-mono">
            {postExitReturn == null ? '—' : formatSignedCurrency(postExitReturn)}
          </span>
        </p>
        <p>
          Continuation{' '}
          <span className="text-silver-100 font-mono">
            {continuation == null ? '—' : `${(continuation * 100).toFixed(1)}%`}
          </span>
        </p>
      </div>
      {showResolutionNote ? (
        <p className="text-silver-400 text-xs">
          Resolution: {resolutionSummary(performance.excursions.resolution)}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ExcursionScatter title="MAE vs PnL" data={mae} />
        <ExcursionScatter title="MFE vs PnL" data={mfe} />
      </div>
    </section>
  )
}

function resolutionSummary(resolution: BacktestPerformance['excursions']['resolution']): string {
  return `tick ${resolution.tick} · minute ${resolution.minute} · candle ${resolution.candle}`
}

function ExcursionScatter({
  title,
  data,
}: {
  title: string
  data: {
    winners: Array<{ id: string; x: number; y: number }>
    losers: Array<{ id: string; x: number; y: number }>
  }
}) {
  return (
    <div className="border-carbon-700/50 rounded-lg border p-3">
      <h4 className="text-silver-200 mb-2 text-xs font-medium">{title}</h4>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
            <ThemedCartesianGrid />
            <XAxis type="number" dataKey="x" name="Excursion" {...themedXAxisProps} />
            <YAxis type="number" dataKey="y" name="PnL" {...themedYAxisProps} />
            <Tooltip cursor={themedTooltipCursor} />
            <Scatter name="Winners" data={data.winners} fill="#34d399" />
            <Scatter name="Breakeven and losing" data={data.losers} fill="#fb7185" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
