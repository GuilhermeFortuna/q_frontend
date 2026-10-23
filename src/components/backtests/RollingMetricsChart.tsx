import { useId, useMemo, useState } from 'react'
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import { formatChartDate, formatSignedCurrency } from '@/components/backtests/chartUtils'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SegmentedToggle, type SegmentedOption } from '@/components/ui/SegmentedToggle'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  chartMargin,
  ThemedCartesianGrid,
  themedTooltipCursor,
  themedXAxisProps,
  themedYAxisProps,
} from '@/lib/charts/rechartsTheme'
import {
  rollingTradeStats,
  type BacktestDistributionData,
  type RollingTradeStatPoint,
} from '@/lib/backtesting/distribution'
import { cn } from '@/lib/utils'
import type { BacktestPerformance, Trade } from '@/types/backtesting'

export type WindowSize = '20' | '50' | '100'
export type RollingMetric = 'win_rate' | 'profit_factor' | 'expectancy'

const METRIC_OPTIONS: SegmentedOption<RollingMetric>[] = [
  { value: 'expectancy', label: 'Expectancy' },
  { value: 'win_rate', label: 'Win rate' },
  { value: 'profit_factor', label: 'Profit factor' },
]

export type RollingMetricsChartProps = {
  trades: Trade[]
  distribution?: BacktestDistributionData
  performance?: BacktestPerformance | null
  className?: string
}

function RollingTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean
  payload?: Array<{ value: number | null; payload?: RollingTradeStatPoint & { label?: string } }>
  label?: string
  metric: RollingMetric
}) {
  if (!active || !payload || !payload.length) return null
  const value = payload[0]?.value
  const item = payload[0]?.payload

  let formattedValue = '—'
  if (value != null && Number.isFinite(value)) {
    if (metric === 'expectancy') formattedValue = formatSignedCurrency(value)
    else if (metric === 'win_rate') formattedValue = `${(value * 100).toFixed(1)}%`
    else formattedValue = value.toFixed(2)
  }

  const metricLabel =
    metric === 'expectancy' ? 'Expectancy' : metric === 'win_rate' ? 'Win rate' : 'Profit factor'

  const dateLabel =
    item?.label ??
    (item?.timestamp
      ? formatChartDate(item.timestamp)
      : label && isNaN(Number(label))
        ? formatChartDate(label)
        : '—')

  return (
    <div className={chartTheme.tooltip.shellClass}>
      <p className={chartTheme.tooltip.labelClass}>{dateLabel}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className={chartTheme.tooltip.nameClass}>{metricLabel}</span>
        <span
          className={cn(
            chartTheme.tooltip.valueClass,
            value != null && value > 0 && metric === 'expectancy'
              ? 'text-emerald-400'
              : value != null && value < 0 && metric === 'expectancy'
                ? 'text-rose-400'
                : 'text-silver-100',
          )}
        >
          {formattedValue}
        </span>
      </div>
    </div>
  )
}

export function RollingMetricsChart({
  trades,
  distribution,
  performance,
  className,
}: RollingMetricsChartProps) {
  const gradientId = useId()
  const [windowSize, setWindowSize] = useState<WindowSize>('50')
  const [metric, setMetric] = useState<RollingMetric>('expectancy')

  const closedTrades = useMemo(
    () => trades.filter((t) => t.status === 'CLOSED' && t.exit_time != null && t.pnl != null),
    [trades],
  )
  const tradeCount = closedTrades.length
  const windowNum = Number(windowSize)

  const windowOptions = useMemo<SegmentedOption<WindowSize>[]>(
    () => [
      { value: '20', label: '20', disabled: tradeCount < 20 },
      { value: '50', label: '50', disabled: tradeCount < 50 },
      { value: '100', label: '100', disabled: tradeCount < 100 },
    ],
    [tradeCount],
  )

  const chartData = useMemo(() => {
    if (tradeCount < windowNum) return []
    let rawPoints: RollingTradeStatPoint[] = []
    if (distribution?.rolling) {
      if (windowSize === '20') rawPoints = distribution.rolling[20]
      else if (windowSize === '50') rawPoints = distribution.rolling[50]
      else if (windowSize === '100') rawPoints = distribution.rolling[100]
    } else {
      rawPoints = rollingTradeStats(trades, windowNum)
    }
    return rawPoints.map((pt) => ({
      ...pt,
      label: formatChartDate(pt.timestamp),
    }))
  }, [tradeCount, windowNum, distribution, windowSize, trades])

  const fullSampleValue = useMemo<number | null>(() => {
    if (!performance?.trades?.all) return null
    if (metric === 'expectancy') return performance.trades.all.expectancy
    if (metric === 'win_rate') return performance.trades.all.win_rate
    if (metric === 'profit_factor') return performance.trades.all.profit_factor
    return null
  }, [performance, metric])

  const gradientOffset = useMemo(() => {
    if (metric !== 'expectancy' || chartData.length === 0) return 0.5
    const values = chartData.map((d) => d.expectancy)
    const max = Math.max(...values)
    const min = Math.min(...values)
    if (max <= 0) return 0
    if (min >= 0) return 1
    return max / (max - min)
  }, [metric, chartData])

  const yAxisFormatter = (val: number) => {
    if (metric === 'win_rate') return `${(val * 100).toFixed(0)}%`
    if (metric === 'expectancy') return formatSignedCurrency(val)
    return val.toFixed(1)
  }

  const strokeColor =
    metric === 'expectancy'
      ? `url(#${gradientId})`
      : metric === 'win_rate'
        ? chartTheme.series.primary
        : chartTheme.series.secondary

  return (
    <section
      aria-label="Rolling metrics"
      className={cn(
        'border-carbon-700/50 bg-carbon-900/35 space-y-3 rounded-xl border p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Rolling metrics" />
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedToggle
            aria-label="Rolling metric"
            options={METRIC_OPTIONS}
            value={metric}
            onChange={setMetric}
          />
          <SegmentedToggle
            aria-label="Rolling window trades"
            options={windowOptions}
            value={windowSize}
            onChange={setWindowSize}
          />
        </div>
      </div>

      {tradeCount === 0 ? (
        <ChartEmptyState message="No closed trades recorded." />
      ) : tradeCount < windowNum ? (
        <ChartEmptyState message={`Needs at least ${windowNum} closed trades`} />
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={chartMargin}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset={gradientOffset} stopColor={chartTheme.semantic.positive} />
                  <stop offset={gradientOffset} stopColor={chartTheme.semantic.negative} />
                </linearGradient>
              </defs>
              <ThemedCartesianGrid />
              <XAxis dataKey="label" minTickGap={40} {...themedXAxisProps} />
              <YAxis tickFormatter={yAxisFormatter} {...themedYAxisProps} />
              <Tooltip cursor={themedTooltipCursor} content={<RollingTooltip metric={metric} />} />

              {metric === 'profit_factor' ? (
                <ReferenceLine
                  y={1.0}
                  stroke={chartTheme.semantic.reference}
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                  label={{
                    value: '1.0',
                    fill: 'var(--color-silver-400)',
                    fontSize: 10,
                    position: 'insideBottomRight',
                  }}
                />
              ) : null}

              {metric === 'expectancy' ? (
                <ReferenceLine
                  y={0}
                  stroke={chartTheme.semantic.reference}
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                />
              ) : null}

              {fullSampleValue != null ? (
                <ReferenceLine
                  y={fullSampleValue}
                  stroke={chartTheme.baseline.stroke}
                  strokeDasharray={chartTheme.baseline.strokeDasharray}
                  label={{
                    value: 'Full sample',
                    fill: chartTheme.baseline.labelFill,
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
              ) : null}

              <Line
                type="monotone"
                dataKey={metric}
                stroke={strokeColor}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
