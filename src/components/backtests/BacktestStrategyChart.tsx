import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { localPoint } from '@visx/event'
import { Grid, RotateCcw, BarChart3, LineChart, AreaChart, ExternalLink } from 'lucide-react'
import { isTauri } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import {
  StrategyIndicatorLayer,
  StrategyOscillatorLayer,
} from '@/components/backtests/StrategyIndicatorLayer'
import { TradeHoverCard } from '@/components/backtests/TradeHoverCard'
import { TradeMarkersLayer } from '@/components/backtests/TradeMarkersLayer'
import {
  processBars,
  applyPriceAxisTransform,
  computePriceDomain,
  usePriceAxis,
  timestampAtX,
} from '@/components/charts/hooks/useChartScales'
import { useChartViewport } from '@/components/charts/hooks/useChartViewport'
import { CandlestickLayer } from '@/components/charts/layers/CandlestickLayer'
import { ChartAxes } from '@/components/charts/layers/ChartAxes'
import { ChartAxisDragHandles } from '@/components/charts/layers/ChartAxisDragHandles'
import { GridLayer } from '@/components/charts/layers/GridLayer'
import { VolumeLayer } from '@/components/charts/layers/VolumeLayer'
import { CrosshairLayer } from '@/components/charts/layers/CrosshairLayer'
import { CHART_MARGINS, buildViewportSlots, barsFromSlots } from '@/components/charts/types/chart'
import { formatCurrency } from '@/components/backtests/chartUtils'
import type { ChartIndicatorSeries, Trade } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

export type BacktestStrategyChartProps = {
  bars: OhlcvBar[]
  indicators: ChartIndicatorSeries[]
  trades: Trade[]
  symbol: string
  timeframe?: string
  runId?: string
}

type BacktestPaneLayout = {
  priceTop: number
  priceHeight: number
  volumeTop: number
  volumeHeight: number
  oscillatorTop?: number
  oscillatorHeight?: number
  innerWidth: number
  innerHeight: number
}

function computeBacktestLayout(
  width: number,
  height: number,
  hasOscillator: boolean,
): BacktestPaneLayout {
  const innerWidth = Math.max(width - CHART_MARGINS.left - CHART_MARGINS.right, 0)
  const innerHeight = Math.max(height - CHART_MARGINS.top - CHART_MARGINS.bottom, 0)
  const volumeHeight = innerHeight * 0.12
  const oscillatorHeight = hasOscillator ? innerHeight * 0.18 : 0
  const priceHeight = innerHeight - volumeHeight - oscillatorHeight

  let cursor = CHART_MARGINS.top
  const priceTop = cursor
  cursor += priceHeight
  const volumeTop = cursor
  cursor += volumeHeight

  return {
    priceTop,
    priceHeight,
    volumeTop,
    volumeHeight,
    oscillatorTop: hasOscillator ? cursor : undefined,
    oscillatorHeight: hasOscillator ? oscillatorHeight : undefined,
    innerWidth,
    innerHeight,
  }
}

function ChartInner({
  width,
  height,
  bars,
  indicators,
  trades,
  symbol,
  timeframe = 'D1',
  runId,
}: BacktestStrategyChartProps & { width: number; height: number }) {
  const processed = useMemo(() => processBars(bars), [bars])
  const hasOscillator = indicators.some((ind) => ind.pane === 'oscillator')
  const layout = useMemo(
    () => computeBacktestLayout(width, height, hasOscillator),
    [width, height, hasOscillator],
  )
  const { viewport, resetViewport, fitAll, zoomAt, panBy, stretchXByPixels } = useChartViewport(
    processed.length,
  )
  const { pricePanOffset, priceScaleFactor, resetPriceAxis, stretchPriceByPixels } = usePriceAxis(
    String(processed.length),
  )
  const viewportSlots = useMemo(
    () => buildViewportSlots(processed, viewport),
    [processed, viewport],
  )
  const visibleBars = useMemo(() => barsFromSlots(viewportSlots), [viewportSlots])
  const visibleTimestamps = useMemo(
    () => new Set(visibleBars.map((bar) => bar.timestamp)),
    [visibleBars],
  )

  const scales = useMemo(() => {
    const domain = viewportSlots.map((s) => s.key)
    const xScale = scaleBand<string>({
      domain,
      range: [0, layout.innerWidth],
      padding: 0.25,
    })

    const priceDomain = computePriceDomain(visibleBars, 0.08)

    const priceScale = scaleLinear<number>({
      domain: applyPriceAxisTransform(priceDomain, pricePanOffset, priceScaleFactor),
      range: [layout.priceTop + layout.priceHeight, layout.priceTop],
      nice: true,
    })

    const maxVolume = Math.max(...visibleBars.map((b) => b.volume), 1)
    const volumeScale = scaleLinear<number>({
      domain: [0, maxVolume],
      range: [layout.volumeTop + layout.volumeHeight, layout.volumeTop],
      nice: true,
    })

    const oscillatorIndicators = indicators.filter((ind) => ind.pane === 'oscillator')
    let oscillatorScale = scaleLinear<number>({
      domain: [-1, 1],
      range: [
        (layout.oscillatorTop ?? 0) + (layout.oscillatorHeight ?? 0),
        layout.oscillatorTop ?? 0,
      ],
      nice: true,
    })

    if (oscillatorIndicators.length > 0 && layout.oscillatorTop !== undefined) {
      const values = oscillatorIndicators.flatMap((ind) =>
        ind.values.filter((v): v is number => v !== null),
      )
      if (values.length > 0) {
        const min = Math.min(...values)
        const max = Math.max(...values)
        const pad = (max - min) * 0.1 || 0.01
        oscillatorScale = oscillatorScale.copy().domain([min - pad, max + pad])
      }
    }

    return { xScale, priceScale, volumeScale, oscillatorScale }
  }, [visibleBars, layout, indicators, pricePanOffset, priceScaleFactor])

  const isPanning = useRef(false)
  const panStart = useRef<{ x: number; y: number } | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartType, setChartType] = useState<'candles' | 'line' | 'area'>('candles')
  const [showGrid, setShowGrid] = useState<boolean>(true)
  const [hoveredBar, setHoveredBar] = useState<(typeof visibleBars)[0] | null>(null)
  const [mouseY, setMouseY] = useState<number | null>(null)
  const [hoveredTrade, setHoveredTrade] = useState<Trade | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).has('run_id')
  }, [])

  const handleOpenWindow = useCallback(() => {
    if (!runId) {
      console.error('No runId available to open standalone window.')
      return
    }
    const url = `/?run_id=${encodeURIComponent(runId)}&symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`

    if (isTauri()) {
      const safeSymbol = symbol.replace(/[^a-zA-Z0-9-]/g, '')
      const windowLabel = `chart-${safeSymbol || 'default'}-${Date.now()}`
      try {
        const chartWindow = new WebviewWindow(windowLabel, {
          url,
          title: `Quant Chart - ${symbol}`,
          width: 1000,
          height: 700,
          resizable: true,
          decorations: false,
          focus: true,
        })
        void chartWindow.once('tauri://error', (event) => {
          console.error('Failed to open Tauri chart window:', event.payload)
        })
      } catch (err) {
        console.error('Failed to open Tauri chart window:', err)
      }
    } else {
      window.open(url, '_blank', 'width=1000,height=700')
    }
  }, [runId, symbol, timeframe])

  useEffect(() => {
    const el = chartRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const bounds = el.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const ratio = Math.max(0, Math.min(1, (x - CHART_MARGINS.left) / layout.innerWidth))
      zoomAt(ratio, event.deltaY)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, layout.innerWidth])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event)
      if (!point) return

      const x = point.x - CHART_MARGINS.left
      const y = point.y

      if (isPanning.current && panStart.current) {
        const barDelta = Math.round(
          (point.x - panStart.current.x) / Math.max(scales.xScale.step(), 4),
        )
        if (barDelta !== 0) {
          panBy(-barDelta)
          panStart.current = { x: point.x, y: point.y }
        }
        return
      }

      // Track cursor position and active bar when not panning
      const bar = timestampAtX(scales.xScale, x, visibleBars)
      setHoveredBar(bar || null)
      setMouseY(y)
    },
    [panBy, scales, visibleBars],
  )

  const handleMouseDown = useCallback((event: React.MouseEvent<SVGRectElement>) => {
    if (event.button !== 0) return
    const point = localPoint(event)
    if (!point) return
    isPanning.current = true
    panStart.current = { x: point.x, y: point.y }
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
    panStart.current = null
  }, [])

  const handleDoubleClick = useCallback(() => {
    fitAll()
    resetPriceAxis()
  }, [fitAll, resetPriceAxis])

  const handleResetView = useCallback(() => {
    resetViewport()
    resetPriceAxis()
  }, [resetViewport, resetPriceAxis])

  const handleStretchX = useCallback(
    (deltaX: number) => {
      stretchXByPixels(deltaX, layout.innerWidth)
    },
    [stretchXByPixels, layout.innerWidth],
  )

  const handleTradeHover = useCallback((trade: Trade | null, event?: React.MouseEvent) => {
    setHoveredTrade(trade)
    if (trade && event && chartRef.current) {
      const bounds = chartRef.current.getBoundingClientRect()
      setHoverPos({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
    } else {
      setHoverPos(null)
    }
  }, [])

  const activeBar = hoveredBar || visibleBars[visibleBars.length - 1] || null
  const activeIndex = activeBar
    ? processed.findIndex((b) => b.timestamp === activeBar.timestamp)
    : -1

  const fNum = (val: number | undefined | null) => (val != null ? val.toFixed(2) : '—')

  let change = 0
  let changePercent = 0
  if (activeBar) {
    change = activeBar.close - activeBar.open
    changePercent = (change / activeBar.open) * 100
  }

  const formatVol = (vol: number | undefined | null) => {
    if (vol == null) return '—'
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`
    return vol.toString()
  }

  return (
    <div
      ref={chartRef}
      className="border-carbon-700 relative flex-1 overflow-hidden overscroll-contain rounded-lg border shadow-2xl"
      style={{
        width,
        height,
        background: 'radial-gradient(circle at 50% 30%, #16273f 0%, #07101c 100%)',
      }}
    >
      {/* Floating HUD status line */}
      {activeBar && (
        <div className="surface-float surface-float--blur text-silver-300 absolute top-2.5 left-3.5 z-10 flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg px-3 py-1.5 font-mono text-[10px] transition-opacity duration-150 select-none sm:text-xs">
          {/* Symbol & Timeframe */}
          <span className="text-brass-400 font-bold tracking-wider uppercase">
            {symbol} · {timeframe}
          </span>

          {/* Timestamp */}
          <span className="text-silver-400 border-carbon-800 border-l pl-3">
            {new Date(activeBar.timestamp).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          {/* OHLC */}
          <span className="border-carbon-800 flex gap-2.5 border-l pl-3">
            <span>
              O<span className="text-silver-100 ml-0.5">{formatCurrency(activeBar.open)}</span>
            </span>
            <span>
              H<span className="text-silver-100 ml-0.5">{formatCurrency(activeBar.high)}</span>
            </span>
            <span>
              L<span className="text-silver-100 ml-0.5">{formatCurrency(activeBar.low)}</span>
            </span>
            <span>
              C
              <span className="text-silver-100 ml-0.5 font-semibold">
                {formatCurrency(activeBar.close)}
              </span>
            </span>
          </span>

          {/* Change */}
          <span className={`font-bold ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {change >= 0 ? '+' : ''}
            {formatCurrency(change)} ({change >= 0 ? '+' : ''}
            {changePercent.toFixed(2)}%)
          </span>

          {/* Volume */}
          <span className="text-silver-400 border-carbon-800 border-l pl-3">
            V <span className="text-silver-100">{formatVol(activeBar.volume)}</span>
          </span>

          {/* Indicator values */}
          {indicators
            .filter((ind) => ind.pane === 'price')
            .map((ind) => {
              const val = activeIndex !== -1 ? ind.values[activeIndex] : null
              return (
                <span
                  key={ind.key}
                  className="border-carbon-800 inline-flex items-center gap-1 border-l pl-3"
                  style={{ color: ind.color ?? '#c9a227' }}
                >
                  <span className="text-[9px] font-bold uppercase opacity-75">{ind.label}:</span>
                  <span className="font-bold">{val != null ? fNum(val) : '—'}</span>
                </span>
              )
            })}
        </div>
      )}

      {/* Floating Toolbar Controls */}
      <div className="surface-float surface-float--blur absolute top-2.5 right-3.5 z-10 flex items-center gap-1 rounded-lg p-1 transition-opacity duration-150 select-none">
        {/* Chart Style Selector */}
        <div className="border-carbon-800/80 mr-1 flex gap-0.5 border-r pr-1.5">
          <button
            type="button"
            onClick={() => setChartType('candles')}
            title="Candlestick Chart"
            className={`rounded-md border p-1.5 transition-all duration-150 active:scale-90 ${
              chartType === 'candles'
                ? 'bg-brass-600/20 text-brass-400 border-brass-500/25 shadow-[0_0_10px_rgba(196,165,116,0.12)]'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-850/50 border-transparent'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setChartType('line')}
            title="Line Chart"
            className={`rounded-md border p-1.5 transition-all duration-150 active:scale-90 ${
              chartType === 'line'
                ? 'bg-brass-600/20 text-brass-400 border-brass-500/25 shadow-[0_0_10px_rgba(196,165,116,0.12)]'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-850/50 border-transparent'
            }`}
          >
            <LineChart className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setChartType('area')}
            title="Area Chart"
            className={`rounded-md border p-1.5 transition-all duration-150 active:scale-90 ${
              chartType === 'area'
                ? 'bg-brass-600/20 text-brass-400 border-brass-500/25 shadow-[0_0_10px_rgba(196,165,116,0.12)]'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-850/50 border-transparent'
            }`}
          >
            <AreaChart className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Grid Toggle */}
        <button
          type="button"
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Gridlines"
          className={`rounded-md border p-1.5 transition-all duration-150 active:scale-90 ${
            showGrid
              ? 'bg-brass-600/20 text-brass-400 border-brass-500/25 shadow-[0_0_10px_rgba(196,165,116,0.12)]'
              : 'text-silver-500 hover:text-silver-300 hover:bg-carbon-850/50 border-transparent'
          }`}
        >
          <Grid className="h-3.5 w-3.5" />
        </button>

        {/* Reset View Button */}
        <button
          type="button"
          onClick={handleResetView}
          title="Reset Zoom/Pan"
          className="text-silver-400 hover:text-brass-400 hover:bg-carbon-850/50 rounded-md border border-transparent p-1.5 transition-all duration-150 active:scale-90"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Popout Standalone Window Button */}
        {!isStandalone && (
          <button
            type="button"
            onClick={handleOpenWindow}
            title="Open in Standalone Window"
            className="text-silver-400 hover:text-brass-400 hover:bg-carbon-850/50 rounded-md border border-transparent p-1.5 transition-all duration-150 active:scale-90"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <svg width={width} height={height}>
        <defs>
          <linearGradient id="bull-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#26a69a" />
            <stop offset="100%" stopColor="#1b7a70" />
          </linearGradient>
          <linearGradient id="bear-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef5350" />
            <stop offset="100%" stopColor="#b73a37" />
          </linearGradient>
          <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(201, 162, 39, 0.22)" />
            <stop offset="100%" stopColor="rgba(201, 162, 39, 0.0)" />
          </linearGradient>
          <linearGradient id="volume-bull-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#26a69a" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#26a69a" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="volume-bear-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef5350" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ef5350" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Background Watermark */}
        {layout.innerWidth > 100 && (
          <g
            pointerEvents="none"
            opacity={0.045}
            transform={`translate(${CHART_MARGINS.left + layout.innerWidth / 2}, ${layout.priceTop + layout.priceHeight / 2})`}
          >
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize={Math.min(layout.innerWidth * 0.12, 64)}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              letterSpacing="0.05em"
            >
              {symbol}
            </text>
            <text
              y={Math.min(layout.innerWidth * 0.08, 40) + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize={Math.min(layout.innerWidth * 0.045, 20)}
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.1em"
            >
              {timeframe}
            </text>
          </g>
        )}

        {showGrid && (
          <GridLayer
            xScale={scales.xScale}
            yScale={scales.priceScale}
            width={layout.innerWidth}
            height={layout.priceHeight}
            top={layout.priceTop}
            left={CHART_MARGINS.left}
          />
        )}

        <VolumeLayer
          bars={visibleBars}
          xScale={scales.xScale}
          yScale={scales.volumeScale}
          left={CHART_MARGINS.left}
        />

        <CandlestickLayer
          bars={visibleBars}
          xScale={scales.xScale}
          yScale={scales.priceScale}
          chartType={chartType}
          left={CHART_MARGINS.left}
        />

        <StrategyIndicatorLayer
          allBars={bars}
          visibleBars={visibleBars}
          xScale={scales.xScale}
          yScale={scales.priceScale}
          indicators={indicators}
          left={CHART_MARGINS.left}
        />

        {hasOscillator &&
          layout.oscillatorTop !== undefined &&
          layout.oscillatorHeight !== undefined && (
            <StrategyOscillatorLayer
              allBars={bars}
              visibleBars={visibleBars}
              xScale={scales.xScale}
              yScale={scales.oscillatorScale}
              indicators={indicators}
              top={layout.oscillatorTop}
              height={layout.oscillatorHeight}
              left={CHART_MARGINS.left}
            />
          )}

        {hasOscillator &&
          layout.oscillatorTop !== undefined &&
          indicators
            .filter((ind) => ind.pane === 'oscillator')
            .map((ind) => {
              const val = activeIndex !== -1 ? ind.values[activeIndex] : null
              return (
                <text
                  key={ind.key}
                  x={CHART_MARGINS.left + 12}
                  y={layout.oscillatorTop! + 16}
                  fill={ind.color ?? '#e2e8f0'}
                  className="font-mono text-[9px] font-bold uppercase opacity-80"
                >
                  {ind.label}: {val != null ? val.toFixed(2) : '—'}
                </text>
              )
            })}

        <ChartAxes
          xScale={scales.xScale}
          priceScale={scales.priceScale}
          volumeScale={scales.volumeScale}
          macdScale={hasOscillator ? scales.oscillatorScale : undefined}
          layout={{
            ...layout,
            macdTop: layout.oscillatorTop,
            macdHeight: layout.oscillatorHeight,
          }}
          timeframe={timeframe}
          left={CHART_MARGINS.left}
          bottom={CHART_MARGINS.bottom}
          height={height}
        />

        <ChartAxisDragHandles
          width={width}
          height={height}
          margins={CHART_MARGINS}
          layout={layout}
          onStretchX={handleStretchX}
          onStretchY={stretchPriceByPixels}
        />

        <rect
          x={CHART_MARGINS.left}
          y={CHART_MARGINS.top}
          width={layout.innerWidth}
          height={layout.innerHeight}
          fill="transparent"
          pointerEvents="all"
          style={{ cursor: isPanning.current ? 'grabbing' : 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp()
            handleTradeHover(null)
            setHoveredBar(null)
            setMouseY(null)
          }}
          onDoubleClick={handleDoubleClick}
        />

        <TradeMarkersLayer
          trades={trades}
          allBars={bars}
          visibleTimestamps={visibleTimestamps}
          xScale={scales.xScale}
          yScale={scales.priceScale}
          left={CHART_MARGINS.left}
          hoveredTradeId={hoveredTrade?.id}
          onTradeHover={handleTradeHover}
        />

        {hoveredBar && (
          <CrosshairLayer
            activeBar={hoveredBar}
            xScale={scales.xScale}
            priceScale={scales.priceScale}
            layout={{
              priceTop: layout.priceTop,
              priceHeight: layout.priceHeight,
              innerWidth: layout.innerWidth,
            }}
            timeframe={timeframe}
            left={CHART_MARGINS.left}
            mouseY={mouseY}
          />
        )}
      </svg>

      {hoveredTrade && hoverPos && (
        <TradeHoverCard
          trade={hoveredTrade}
          x={hoverPos.x}
          y={hoverPos.y}
          containerWidth={width}
          containerHeight={height}
        />
      )}
    </div>
  )
}

function ChartLegend({ indicators }: { indicators: ChartIndicatorSeries[] }) {
  const priceIndicators = indicators.filter((ind) => ind.pane === 'price')

  return (
    <div className="text-silver-400 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {priceIndicators.map((ind) => (
        <span key={ind.key} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{ backgroundColor: ind.color ?? '#c9a227' }}
          />
          {ind.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0 w-0 border-r-[5px] border-b-[8px] border-l-[5px] border-r-transparent border-b-emerald-400 border-l-transparent" />
        Long entry
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0 w-0 border-t-[8px] border-r-[5px] border-l-[5px] border-t-rose-400 border-r-transparent border-l-transparent" />
        Short entry
      </span>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="text-silver-500 mr-1">Exits:</span>
        <span className="mr-2 inline-flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/80 text-[7px] font-bold text-[#07101c]">
            SL
          </span>
          <span className="text-silver-300">Stop Loss</span>
        </span>
        <span className="mr-2 inline-flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/80 text-[7px] font-bold text-[#07101c]">
            TP
          </span>
          <span className="text-silver-300">Take Profit</span>
        </span>
        <span className="mr-2 inline-flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/80 text-[7px] font-bold text-[#07101c]">
            TS
          </span>
          <span className="text-silver-300">Trailing</span>
        </span>
        <span className="mr-2 inline-flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/80 text-[7px] font-bold text-[#07101c]">
            S
          </span>
          <span className="text-silver-300">Signal</span>
        </span>
        <span className="mr-2 inline-flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/80 text-[7px] font-bold text-[#07101c]">
            D
          </span>
          <span className="text-silver-300">Intraday</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/80 text-[7px] font-bold text-[#07101c]">
            F
          </span>
          <span className="text-silver-300">Force</span>
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 bg-emerald-400/60" />
        Winning trade
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 bg-rose-400/60" />
        Losing trade
      </span>
      <span className="text-silver-500">
        Scroll to zoom · drag plot to pan · drag axes to stretch · double-click to fit all
      </span>
    </div>
  )
}

export function BacktestStrategyChart(props: BacktestStrategyChartProps) {
  const { parentRef, width, height } = useParentSize({ debounceTime: 50 })

  if (props.bars.length === 0) {
    return <ChartEmptyState message="No price data available for this backtest." />
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div ref={parentRef} className="relative min-h-0 flex-1 overflow-hidden">
        {width > 0 && height > 0 ? (
          <div className="absolute inset-0">
            <ChartInner {...props} width={width} height={height} />
          </div>
        ) : null}
      </div>
      <ChartLegend indicators={props.indicators} />
    </div>
  )
}
