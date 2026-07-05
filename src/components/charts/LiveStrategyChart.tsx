import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { localPoint } from '@visx/event'

import { CandlestickLayer } from '@/components/charts/layers/CandlestickLayer'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import {
  BULL_COLOR,
  BEAR_COLOR,
  GRID_COLOR,
  type ChartMarker,
  type PrecomputedIndicatorSeries,
  type ProcessedBar,
} from '@/components/charts/types/chart'
import { processBars, timestampAtX } from '@/components/charts/hooks/useChartScales'
import { useChartViewport } from '@/components/charts/hooks/useChartViewport'
import { linePath, visibleTimestampSet } from '@/components/charts/utils/indicatorPaths'
import { formatTimeAxisLabel } from '@/lib/market/timeframes'
import { chartTheme } from '@/lib/charts/chartTheme'
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
  height?: number | string
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
        <path
          d={`M ${cx} ${y - 9} L ${cx - 6} ${y + 3} L ${cx + 6} ${y + 3} Z`}
          fill={BULL_COLOR}
        />
        {detail}
      </g>
    )
  }
  if (marker.kind === 'sell') {
    const y = priceScale(barHigh) - 14
    return (
      <g key={marker.id} data-testid={`live-chart-marker-${marker.id}`} data-kind="sell">
        <path
          d={`M ${cx} ${y + 9} L ${cx - 6} ${y - 3} L ${cx + 6} ${y - 3} Z`}
          fill={BEAR_COLOR}
        />
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
  const displayBars = useMemo(() => (formingBar ? [...bars, formingBar] : bars), [bars, formingBar])

  const resetKey = `${symbol}:${timeframe}`
  const { viewport, resetViewport, zoomAt, panBy } = useChartViewport(displayBars.length, resetKey)

  // Pre-process display bars to ProcessedBar[] for crosshair and rendering
  const processedBars = useMemo(() => processBars(displayBars), [displayBars])

  // Build slots to allow empty padding space on the right side when panning
  const viewportSlots = useMemo(() => {
    const slots = []
    for (let i = viewport.startIndex; i <= viewport.endIndex; i += 1) {
      const bar = processedBars[i] ?? null
      slots.push({ key: bar?.timestamp ?? `__pad:${i}`, bar })
    }
    return slots
  }, [processedBars, viewport.startIndex, viewport.endIndex])

  const visibleBars = useMemo(() => {
    return viewportSlots.flatMap((slot) => (slot.bar ? [slot.bar] : []))
  }, [viewportSlots])

  // Sliced processed bars for completed and forming layers
  const visibleCompletedBars = useMemo(() => {
    return visibleBars.filter((b) => b.timestamp !== formingBar?.timestamp)
  }, [visibleBars, formingBar])

  const visibleFormingBar = useMemo(() => {
    return visibleBars.find((b) => b.timestamp === formingBar?.timestamp) ?? null
  }, [visibleBars, formingBar])

  const completedProcessed = useMemo(
    () => processBars(visibleCompletedBars),
    [visibleCompletedBars],
  )
  const formingProcessed = useMemo(
    () => (visibleFormingBar ? processBars([visibleFormingBar]) : []),
    [visibleFormingBar],
  )

  const completedSet = useMemo(
    () => visibleTimestampSet(visibleCompletedBars.map((bar) => bar.timestamp)),
    [visibleCompletedBars],
  )

  const [hoveredBar, setHoveredBar] = useState<ProcessedBar | null>(null)
  const [mouseY, setMouseY] = useState<number | null>(null)

  const priceOverlays = useMemo(
    () => indicators.filter((series) => series.pane === 'price'),
    [indicators],
  )
  const oscillators = useMemo(
    () => indicators.filter((series) => series.pane === 'oscillator'),
    [indicators],
  )

  const barByTimestamp = useMemo(() => {
    const map = new Map<string, OhlcvBar>()
    for (const bar of displayBars) map.set(bar.timestamp, bar)
    return map
  }, [displayBars])

  const innerWidth = Math.max(width - MARGINS.left - MARGINS.right, 0)
  const innerHeight = Math.max(height - MARGINS.top - MARGINS.bottom, 0)

  const oscHeight =
    oscillators.length > 0 ? Math.min(MAX_OSCILLATOR_HEIGHT, innerHeight * OSCILLATOR_RATIO) : 0
  const priceHeight = Math.max(innerHeight - oscHeight * oscillators.length, 0)
  const priceTop = MARGINS.top

  const xScale: BandScale = useMemo(
    () =>
      scaleBand<string>({
        domain: viewportSlots.map((slot) => slot.key),
        range: [0, innerWidth],
        padding: 0.25,
      }),
    [viewportSlots, innerWidth],
  )

  const priceScale: LinearScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: priceDomainFor(visibleBars),
        range: [priceTop + priceHeight, priceTop],
        nice: true,
      }),
    [visibleBars, priceHeight, priceTop],
  )

  const priceTicks = useMemo(() => {
    const [min, max] = priceScale.domain() as [number, number]
    const count = 4
    return Array.from({ length: count + 1 }, (_, i) => min + ((max - min) * i) / count)
  }, [priceScale])

  const timeTicks = useMemo(() => {
    if (visibleBars.length === 0) return [] as { ts: string; label: string }[]
    const count = Math.min(5, visibleBars.length)
    const step = Math.max(1, Math.floor(visibleBars.length / count))
    const ticks: { ts: string; label: string }[] = []
    for (let i = 0; i < visibleBars.length; i += step) {
      ticks.push({
        ts: visibleBars[i].timestamp,
        label: formatTimeAxisLabel(visibleBars[i].timestamp, timeframe),
      })
    }
    return ticks
  }, [visibleBars, timeframe])

  const bandwidth = xScale.bandwidth()

  // Zoom/pan interaction handlers
  const chartRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const panStart = useRef<{ x: number; y: number } | null>(null)

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return
    const point = localPoint(event)
    if (!point) return
    isPanning.current = true
    panStart.current = { x: point.x, y: point.y }
  }, [])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const point = localPoint(event)
      if (!point) return
      const x = point.x - MARGINS.left
      const y = point.y

      if (isPanning.current && panStart.current) {
        const step = innerWidth / (viewport.endIndex - viewport.startIndex + 1)
        const barDelta = Math.round((point.x - panStart.current.x) / Math.max(step, 4))
        if (barDelta !== 0) {
          panBy(-barDelta)
          panStart.current = { x: point.x, y: point.y }
        }
        return
      }

      // Track cursor position and hovered bar when not panning
      const allProcessed = [...completedProcessed, ...formingProcessed]
      const bar = timestampAtX(xScale, x, allProcessed)
      setHoveredBar(bar || null)
      setMouseY(y)
    },
    [
      panBy,
      innerWidth,
      viewport.startIndex,
      viewport.endIndex,
      completedProcessed,
      formingProcessed,
      xScale,
    ],
  )

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
    panStart.current = null
  }, [])

  const handleMouseLeave = useCallback(() => {
    isPanning.current = false
    panStart.current = null
    setHoveredBar(null)
    setMouseY(null)
  }, [])

  const handleDoubleClick = useCallback(() => {
    resetViewport()
  }, [resetViewport])

  useEffect(() => {
    const el = chartRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const bounds = el.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const ratio = Math.max(0, Math.min(1, (x - MARGINS.left) / innerWidth))
      zoomAt(ratio, event.deltaY)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, innerWidth])

  const activeBar = hoveredBar || processedBars[processedBars.length - 1] || null
  let change = 0
  let changePercent = 0
  if (activeBar) {
    change = activeBar.close - activeBar.open
    changePercent = (change / activeBar.open) * 100
  }

  return (
    <div ref={chartRef} className="relative h-full w-full cursor-crosshair select-none">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${symbol} ${timeframe} live chart`}
      >
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
            const color =
              series.color ?? DEFAULT_OVERLAY_COLORS[index % DEFAULT_OVERLAY_COLORS.length]
            return (
              <path
                key={series.key}
                data-testid={`live-chart-overlay-${series.key}`}
                d={linePath(series.values, displayBars, completedSet, xScale, priceScale)}
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
          const slicedOscValues = series.values.slice(viewport.startIndex, viewport.endIndex + 1)
          const oscScale: LinearScale = scaleLinear<number>({
            domain: seriesDomain(slicedOscValues),
            range: [top + oscHeight - 6, top + 6],
            nice: true,
          })
          const color =
            series.color ?? DEFAULT_OVERLAY_COLORS[index % DEFAULT_OVERLAY_COLORS.length]
          return (
            <g key={series.key} data-testid={`live-chart-oscillator-${series.key}`}>
              <rect
                x={MARGINS.left}
                y={top}
                width={innerWidth}
                height={oscHeight}
                fill="rgba(7, 16, 28, 0.35)"
                stroke={chartTheme.axis.stroke}
                shapeRendering="crispEdges"
              />
              <g transform={`translate(${MARGINS.left}, 0)`}>
                <path
                  d={linePath(series.values, displayBars, completedSet, xScale, oscScale)}
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
              fill={chartTheme.axis.tick.fill}
              fontSize={chartTheme.axis.tick.fontSize}
              fontFamily="monospace"
              style={{ fontVariantNumeric: chartTheme.axis.tick.fontVariantNumeric }}
              textAnchor="middle"
            >
              {tick.label}
            </text>
          )
        })}

        {/* Hover crosshairs */}
        {hoveredBar && (
          <g>
            <line
              x1={MARGINS.left + (xScale(hoveredBar.timestamp) ?? 0) + bandwidth / 2}
              y1={MARGINS.top}
              x2={MARGINS.left + (xScale(hoveredBar.timestamp) ?? 0) + bandwidth / 2}
              y2={MARGINS.top + innerHeight}
              stroke={chartTheme.crosshair.stroke}
              strokeWidth={1}
              strokeDasharray={chartTheme.crosshair.strokeDasharray}
            />
          </g>
        )}
        {hoveredBar &&
          mouseY !== null &&
          mouseY >= MARGINS.top &&
          mouseY <= MARGINS.top + innerHeight && (
            <g>
              <line
                x1={MARGINS.left}
                y1={mouseY}
                x2={MARGINS.left + innerWidth}
                y2={mouseY}
                stroke={chartTheme.crosshair.stroke}
                strokeWidth={1}
                strokeDasharray={chartTheme.crosshair.strokeDasharray}
              />
              <text
                x={MARGINS.left + innerWidth + 4}
                y={mouseY + 3}
                fill={chartTheme.candle.brass}
                fontSize={9}
                fontFamily="monospace"
                className="font-bold"
              >
                {priceScale.invert(mouseY).toFixed(2)}
              </text>
            </g>
          )}

        {/* OHLCV Legend */}
        {activeBar && (
          <text
            x={MARGINS.left + 4}
            y={MARGINS.top + 14}
            fill="#e5e7eb"
            fontSize={10}
            fontFamily="monospace"
            className="font-bold select-none"
          >
            <tspan fill="#9ca3af">O:</tspan> {activeBar.open.toFixed(2)}{' '}
            <tspan fill="#9ca3af">H:</tspan> {activeBar.high.toFixed(2)}{' '}
            <tspan fill="#9ca3af">L:</tspan> {activeBar.low.toFixed(2)}{' '}
            <tspan fill="#9ca3af">C:</tspan> {activeBar.close.toFixed(2)}{' '}
            <tspan fill="#9ca3af">V:</tspan> {activeBar.volume.toLocaleString()}{' '}
            {change !== 0 && (
              <tspan fill={change >= 0 ? '#26a69a' : '#ef5350'}>
                ({change >= 0 ? '+' : ''}
                {changePercent.toFixed(2)}%)
              </tspan>
            )}
          </text>
        )}

        {/* Background interactions rect */}
        <rect
          x={MARGINS.left}
          y={MARGINS.top}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
        />
      </svg>
      {/* Reset Zoom HUD button */}
      <button
        onClick={() => {
          resetViewport()
        }}
        className="bg-carbon-900/80 hover:bg-carbon-800 text-silver-300 border-carbon-700 hover:border-brass-600/40 absolute right-4 bottom-10 z-20 cursor-pointer rounded border px-2.5 py-1 font-mono text-[10px] font-bold uppercase shadow-md transition-all"
        title="Double-click chart area to fit all"
      >
        Reset Zoom
      </button>
    </div>
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
  const isPercent = typeof height === 'string' && height.endsWith('%')

  if (bars.length === 0) {
    return (
      <div
        className="border-carbon-700 text-silver-500 flex items-center justify-center rounded-lg border text-sm"
        style={{ height: isPercent ? height : `${height}px` }}
        data-testid="live-chart-empty"
      >
        No chart bars available yet.
      </div>
    )
  }

  return (
    <div
      className={`border-carbon-700 bg-carbon-950/60 relative w-full overflow-hidden rounded-lg border ${
        isPercent ? 'h-full flex-1' : ''
      }`}
      style={{ height: isPercent ? height : `${height}px` }}
      data-testid="live-strategy-chart"
    >
      <ParentSize debounceTime={50}>
        {({ width, height: measuredHeight }) =>
          width > 0 && measuredHeight > 0 ? (
            <ChartBody
              width={width}
              height={measuredHeight}
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
