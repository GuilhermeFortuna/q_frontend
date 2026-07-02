import { useMemo } from 'react'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'

import { CandlestickLayer } from '@/components/charts/layers/CandlestickLayer'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import {
  BULL_COLOR,
  BEAR_COLOR,
  GRID_COLOR,
  type ChartMarker,
  type PrecomputedIndicatorSeries,
} from '@/components/charts/types/chart'
import { processBars } from '@/components/charts/hooks/useChartScales'
import { linePath, visibleTimestampSet } from '@/components/charts/utils/indicatorPaths'
import { formatTimeAxisLabel } from '@/lib/market/timeframes'
import type { OhlcvBar } from '@/types/api'

export type LiveStrategyChartProps = {
  /** Completed bars, oldest → newest. Indicator values align to these by index. */
  bars: OhlcvBar[]
  /** Live in-progress bar rendered at reduced opacity; indicators never extend into it. */
  formingBar?: OhlcvBar | null
  /** Backend-computed indicator series (rendered verbatim, never recomputed). */
  indicators?: PrecomputedIndicatorSeries[]
  markers?: ChartMarker[]
  symbol: string
  timeframe: string
  height?: number
}

const MARGINS = { top: 12, right: 58, bottom: 22, left: 8 }
const MAX_OSCILLATOR_HEIGHT = 84
const OSCILLATOR_RATIO = 0.2
const DEFAULT_OVERLAY_COLORS = ['#c9a227', '#6eb5ff', '#a78bfa', '#f97316', '#26a69a']

function priceDomainFor(bars: OhlcvBar[]): [number, number] {
  if (bars.length === 0) return [0, 1]
  const min = Math.min(...bars.map((b) => b.low))
  const max = Math.max(...bars.map((b) => b.high))
  const pad = (max - min) * 0.06 || 1
  return [min - pad, max + pad]
}

function seriesDomain(values: (number | null)[]): [number, number] {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return [0, 1]
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const pad = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1
  return [min - pad, max + pad]
}

function markerGlyph(
  marker: ChartMarker,
  cx: number,
  barHigh: number,
  barLow: number,
  priceScale: LinearScale,
) {
  const detail = <title>{marker.detail}</title>
  if (marker.kind === 'buy') {
    const y = priceScale(barLow) + 14
    return (
      <g key={marker.id} data-testid={`live-chart-marker-${marker.id}`} data-kind="buy">
        <path d={`M ${cx} ${y - 9} L ${cx - 6} ${y + 3} L ${cx + 6} ${y + 3} Z`} fill={BULL_COLOR} />
        {detail}
      </g>
    )
  }
  if (marker.kind === 'sell') {
    const y = priceScale(barHigh) - 14
    return (
      <g key={marker.id} data-testid={`live-chart-marker-${marker.id}`} data-kind="sell">
        <path d={`M ${cx} ${y + 9} L ${cx - 6} ${y - 3} L ${cx + 6} ${y - 3} Z`} fill={BEAR_COLOR} />
        {detail}
      </g>
    )
  }
  if (marker.kind === 'close') {
    const y = priceScale(barHigh) - 14
    return (
      <g key={marker.id} data-testid={`live-chart-marker-${marker.id}`} data-kind="close">
        <rect x={cx - 5} y={y - 5} width={10} height={10} rx={2} fill="#e5e7eb" />
        {detail}
      </g>
    )
  }
  const y = marker.price != null ? priceScale(marker.price) : priceScale((barHigh + barLow) / 2)
  return (
    <g key={marker.id} data-testid={`live-chart-marker-${marker.id}`} data-kind="fill">
      <circle cx={cx} cy={y} r={3.5} fill="#f5f5f5" stroke="#0b1220" strokeWidth={1} />
      {detail}
    </g>
  )
}

function ChartBody({
  width,
  height,
  bars,
  formingBar,
  indicators,
  markers,
  symbol,
  timeframe,
}: Required<Omit<LiveStrategyChartProps, 'height'>> & { width: number; height: number }) {
  const displayBars = useMemo(
    () => (formingBar ? [...bars, formingBar] : bars),
    [bars, formingBar],
  )

  const priceOverlays = useMemo(
    () => indicators.filter((series) => series.pane === 'price'),
    [indicators],
  )
  const oscillators = useMemo(
    () => indicators.filter((series) => series.pane === 'oscillator'),
    [indicators],
  )

  const innerWidth = Math.max(width - MARGINS.left - MARGINS.right, 0)
  const innerHeight = Math.max(height - MARGINS.top - MARGINS.bottom, 0)

  const oscHeight =
    oscillators.length > 0
      ? Math.min(MAX_OSCILLATOR_HEIGHT, innerHeight * OSCILLATOR_RATIO)
      : 0
  const priceHeight = Math.max(innerHeight - oscHeight * oscillators.length, 0)
  const priceTop = MARGINS.top

  const xScale: BandScale = useMemo(
    () =>
      scaleBand<string>({
        domain: displayBars.map((bar) => bar.timestamp),
        range: [0, innerWidth],
        padding: 0.25,
      }),
    [displayBars, innerWidth],
  )

  const priceScale: LinearScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: priceDomainFor(displayBars),
        range: [priceTop + priceHeight, priceTop],
        nice: true,
      }),
    [displayBars, priceHeight, priceTop],
  )

  const completedProcessed = useMemo(() => processBars(bars), [bars])
  const formingProcessed = useMemo(
    () => (formingBar ? processBars([formingBar]) : []),
    [formingBar],
  )

  const completedSet = useMemo(
    () => visibleTimestampSet(bars.map((bar) => bar.timestamp)),
    [bars],
  )

  const barByTimestamp = useMemo(() => {
    const map = new Map<string, OhlcvBar>()
    for (const bar of displayBars) map.set(bar.timestamp, bar)
    return map
  }, [displayBars])

  const priceTicks = useMemo(() => {
    const [min, max] = priceScale.domain() as [number, number]
    const count = 4
    return Array.from({ length: count + 1 }, (_, i) => min + ((max - min) * i) / count)
  }, [priceScale])

  const timeTicks = useMemo(() => {
    if (displayBars.length === 0) return [] as { ts: string; label: string }[]
    const count = Math.min(5, displayBars.length)
    const step = Math.max(1, Math.floor(displayBars.length / count))
    const ticks: { ts: string; label: string }[] = []
    for (let i = 0; i < displayBars.length; i += step) {
      ticks.push({
        ts: displayBars[i].timestamp,
        label: formatTimeAxisLabel(displayBars[i].timestamp, timeframe),
      })
    }
    return ticks
  }, [displayBars, timeframe])

  const bandwidth = xScale.bandwidth()

  return (
    <svg width={width} height={height} role="img" aria-label={`${symbol} ${timeframe} live chart`}>
      <defs>
        <linearGradient id="bull-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#26a69a" />
          <stop offset="100%" stopColor="#1b7a70" />
        </linearGradient>
        <linearGradient id="bear-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef5350" />
          <stop offset="100%" stopColor="#b73a37" />
        </linearGradient>
      </defs>

      {priceTicks.map((value) => {
        const y = priceScale(value)
        return (
          <g key={`price-grid-${value}`}>
            <line
              x1={MARGINS.left}
              x2={MARGINS.left + innerWidth}
              y1={y}
              y2={y}
              stroke={GRID_COLOR}
              shapeRendering="crispEdges"
            />
            <text
              x={MARGINS.left + innerWidth + 4}
              y={y + 3}
              fill="#6b7280"
              fontSize={9}
              fontFamily="monospace"
            >
              {value.toFixed(2)}
            </text>
          </g>
        )
      })}

      <CandlestickLayer
        bars={completedProcessed}
        xScale={xScale}
        yScale={priceScale}
        chartType="candles"
        left={MARGINS.left}
      />

      {formingProcessed.length > 0 && (
        <g opacity={0.4} data-testid="live-chart-forming-bar">
          <CandlestickLayer
            bars={formingProcessed}
            xScale={xScale}
            yScale={priceScale}
            chartType="candles"
            left={MARGINS.left}
            candleOpacity={0.35}
          />
        </g>
      )}

      <g transform={`translate(${MARGINS.left}, 0)`}>
        {priceOverlays.map((series, index) => {
          const color = series.color ?? DEFAULT_OVERLAY_COLORS[index % DEFAULT_OVERLAY_COLORS.length]
          return (
            <path
              key={series.key}
              data-testid={`live-chart-overlay-${series.key}`}
              d={linePath(series.values, bars, completedSet, xScale, priceScale)}
              fill="none"
              stroke={color}
              strokeWidth={1.3}
            />
          )
        })}
      </g>

      {markers.map((marker) => {
        const x = xScale(marker.timestamp)
        if (x == null) return null
        const bar = barByTimestamp.get(marker.timestamp)
        if (!bar) return null
        const cx = x + bandwidth / 2
        return markerGlyph(marker, cx, bar.high, bar.low, priceScale)
      })}

      {oscillators.map((series, index) => {
        const top = priceTop + priceHeight + oscHeight * index
        const oscScale: LinearScale = scaleLinear<number>({
          domain: seriesDomain(series.values),
          range: [top + oscHeight - 6, top + 6],
          nice: true,
        })
        const color = series.color ?? DEFAULT_OVERLAY_COLORS[index % DEFAULT_OVERLAY_COLORS.length]
        return (
          <g key={series.key} data-testid={`live-chart-oscillator-${series.key}`}>
            <rect
              x={MARGINS.left}
              y={top}
              width={innerWidth}
              height={oscHeight}
              fill="rgba(7, 16, 28, 0.35)"
              stroke="rgba(111, 119, 133, 0.15)"
              shapeRendering="crispEdges"
            />
            <g transform={`translate(${MARGINS.left}, 0)`}>
              <path
                d={linePath(series.values, bars, completedSet, xScale, oscScale)}
                fill="none"
                stroke={color}
                strokeWidth={1.2}
              />
            </g>
            <text
              x={MARGINS.left + 4}
              y={top + 12}
              fill="#9ca3af"
              fontSize={9}
              fontFamily="monospace"
            >
              {series.label}
            </text>
          </g>
        )
      })}

      {timeTicks.map((tick) => {
        const x = xScale(tick.ts)
        if (x == null) return null
        return (
          <text
            key={`time-${tick.ts}`}
            x={MARGINS.left + x + bandwidth / 2}
            y={height - 6}
            fill="#6b7280"
            fontSize={9}
            fontFamily="monospace"
            textAnchor="middle"
          >
            {tick.label}
          </text>
        )
      })}
    </svg>
  )
}

export function LiveStrategyChart({
  bars,
  formingBar = null,
  indicators = [],
  markers = [],
  symbol,
  timeframe,
  height = 380,
}: LiveStrategyChartProps) {
  if (bars.length === 0) {
    return (
      <div
        className="border-carbon-700 text-silver-500 flex items-center justify-center rounded-lg border text-sm"
        style={{ height }}
        data-testid="live-chart-empty"
      >
        No chart bars available yet.
      </div>
    )
  }

  return (
    <div
      className="border-carbon-700 bg-carbon-950/60 relative w-full overflow-hidden rounded-lg border"
      style={{ height }}
      data-testid="live-strategy-chart"
    >
      <ParentSize debounceTime={50}>
        {({ width }) =>
          width > 0 ? (
            <ChartBody
              width={width}
              height={height}
              bars={bars}
              formingBar={formingBar}
              indicators={indicators}
              markers={markers}
              symbol={symbol}
              timeframe={timeframe}
            />
          ) : null
        }
      </ParentSize>
    </div>
  )
}
