import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react'
import { ParentSize } from '@visx/responsive'
import { localPoint } from '@visx/event'

import {
  CHART_MARGINS,
  buildViewportSlots,
  barsFromSlots,
  type ChartType,
  type ChartViewport,
  type DataPoint,
  type DrawingObject,
  type DrawingTool,
  type IndicatorConfig,
} from '@/components/charts/types/chart'
import {
  computePaneLayout,
  computePriceDomain,
  dataPointFromEvent,
  processBars,
  timestampAtX,
  useChartScales,
  usePricePan,
} from '@/components/charts/hooks/useChartScales'
import { useChartViewport } from '@/components/charts/hooks/useChartViewport'
import { CandlestickLayer } from '@/components/charts/layers/CandlestickLayer'
import { VolumeLayer } from '@/components/charts/layers/VolumeLayer'
import { GridLayer } from '@/components/charts/layers/GridLayer'
import { ChartAxes } from '@/components/charts/layers/ChartAxes'
import { IndicatorLayer } from '@/components/charts/layers/IndicatorLayer'
import { OscillatorPane } from '@/components/charts/layers/OscillatorPane'
import { CrosshairLayer } from '@/components/charts/layers/CrosshairLayer'
import { DrawingLayer } from '@/components/charts/layers/DrawingLayer'
import { ChevronRight } from 'lucide-react'

import { macd } from '@/lib/indicators'
import { newDrawingId } from '@/components/charts/hooks/useDrawings'
import type { OhlcvBar } from '@/types/api'

export type CandlestickChartHandle = {
  shiftViewport: (delta: number) => void
  panBy: (barDelta: number) => void
  scrollToEnd: () => void
}

export type CandlestickChartProps = {
  data: OhlcvBar[]
  symbol: string
  timeframe?: string
  resetKey?: string
  showGrid?: boolean
  chartType?: ChartType
  indicators?: IndicatorConfig[]
  activeDrawingTool?: DrawingTool
  drawings?: DrawingObject[]
  onDrawingsChange?: (drawings: DrawingObject[]) => void
  onHoverBar?: (bar: OhlcvBar | null) => void
  onViewportChange?: (viewport: ChartViewport) => void
}

const ChartInner = forwardRef<
  CandlestickChartHandle,
  CandlestickChartProps & { width: number; height: number }
>(function ChartInner(
  {
    width,
    height,
    data,
    symbol,
    timeframe = '1D',
    resetKey,
    showGrid = true,
    chartType = 'candles',
    indicators = [],
    activeDrawingTool = 'cursor',
    drawings = [],
    onDrawingsChange,
    onHoverBar,
    onViewportChange,
  },
  ref,
) {
  const processed = useMemo(() => processBars(data), [data])
  const viewportResetKey = resetKey ?? `${symbol}:${timeframe}`
  const { viewport, scrollToEnd, fitAll, zoomAt, panBy, shiftViewport } = useChartViewport(
    processed.length,
    viewportResetKey,
  )
  const { pricePanOffset, resetPricePan, panPriceByPixels } = usePricePan(viewportResetKey)

  const viewportSlots = useMemo(
    () => buildViewportSlots(processed, viewport),
    [processed, viewport],
  )
  const visibleBars = useMemo(() => barsFromSlots(viewportSlots), [viewportSlots])

  const isViewportUnset = viewport.startIndex === 0 && viewport.endIndex === 0
  const isAtLatestCandle =
    processed.length === 0 || isViewportUnset || viewport.endIndex === processed.length - 1

  useImperativeHandle(ref, () => ({ shiftViewport, panBy, scrollToEnd }), [
    shiftViewport,
    panBy,
    scrollToEnd,
  ])

  const layout = useMemo(
    () => computePaneLayout(width, height, indicators, CHART_MARGINS),
    [width, height, indicators],
  )

  const scales = useChartScales(viewportSlots, layout, CHART_MARGINS, pricePanOffset)

  const macdValues = useMemo(() => {
    const macdInd = indicators.find((i) => i.type === 'macd' && i.enabled)
    if (!macdInd || macdInd.type !== 'macd') return null
    return macd(data, macdInd.fast, macdInd.slow, macdInd.signal)
  }, [data, indicators])

  const macdScale = useMemo(() => {
    if (!macdValues || !layout.macdTop) return scales.macdScale
    const vals = macdValues.macd.filter((v): v is number => v !== null)
    const sig = macdValues.signal.filter((v): v is number => v !== null)
    const hist = macdValues.histogram.filter((v): v is number => v !== null)
    const all = [...vals, ...sig, ...hist]
    if (all.length === 0) return scales.macdScale
    const min = Math.min(...all)
    const max = Math.max(...all)
    const pad = (max - min) * 0.1 || 0.01
    return scales.macdScale.copy().domain([min - pad, max + pad])
  }, [macdValues, layout.macdTop, scales.macdScale])

  const [hoveredBar, setHoveredBar] = useState<(typeof visibleBars)[0] | null>(null)
  const [mouseY, setMouseY] = useState<number | null>(null)
  const [draftPoint, setDraftPoint] = useState<DataPoint | null>(null)
  const [draftDrawing, setDraftDrawing] = useState<DrawingObject | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef<{ x: number; y: number } | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onViewportChange?.(viewport)
  }, [viewport, onViewportChange])

  useEffect(() => {
    if (activeDrawingTool === 'cursor' && hoveredBar) {
      onHoverBar?.(hoveredBar)
    } else if (activeDrawingTool !== 'cursor') {
      onHoverBar?.(null)
    }
  }, [hoveredBar, activeDrawingTool, onHoverBar])

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
        const deltaY = point.y - panStart.current.y
        if (barDelta !== 0) {
          panBy(-barDelta)
        }
        if (deltaY !== 0) {
          const { span } = computePriceDomain(visibleBars)
          panPriceByPixels(deltaY, layout.priceHeight, span)
        }
        if (barDelta !== 0 || deltaY !== 0) {
          panStart.current = { x: point.x, y: point.y }
        }
        return
      }

      const bar = timestampAtX(scales.xScale, x, visibleBars)
      setHoveredBar(bar)
      setMouseY(y)

      if (draftPoint && draftDrawing) {
        const dp = dataPointFromEvent(x, y, scales.xScale, scales.priceScale, visibleBars)
        if (!dp) return
        if (draftDrawing.type === 'trendline' || draftDrawing.type === 'fibo') {
          setDraftDrawing({ ...draftDrawing, p2: dp })
        }
      }
    },
    [visibleBars, scales, draftPoint, draftDrawing, panBy, panPriceByPixels, layout.priceHeight],
  )

  const finishDrawing = useCallback(
    (drawing: DrawingObject) => {
      onDrawingsChange?.([...drawings, drawing])
      setDraftPoint(null)
      setDraftDrawing(null)
    },
    [drawings, onDrawingsChange],
  )

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      if (activeDrawingTool === 'cursor') {
        if (event.button === 0) {
          const point = localPoint(event)
          if (!point) return
          isPanning.current = true
          panStart.current = { x: point.x, y: point.y }
        }
        return
      }

      const point = localPoint(event)
      if (!point) return
      const x = point.x - CHART_MARGINS.left
      const y = point.y
      const dp = dataPointFromEvent(x, y, scales.xScale, scales.priceScale, visibleBars)
      if (!dp) return

      if (activeDrawingTool === 'horizontal') {
        finishDrawing({ id: newDrawingId(), type: 'horizontal', price: dp.price })
        return
      }

      if (activeDrawingTool === 'text') {
        const label = window.prompt('Label', 'Note') ?? 'Note'
        finishDrawing({ id: newDrawingId(), type: 'text', point: dp, label })
        return
      }

      if (activeDrawingTool === 'trendline' || activeDrawingTool === 'fibo') {
        if (!draftPoint) {
          setDraftPoint(dp)
          setDraftDrawing({
            id: 'draft',
            type: activeDrawingTool,
            p1: dp,
            p2: dp,
          })
        } else {
          finishDrawing({
            id: newDrawingId(),
            type: activeDrawingTool,
            p1: draftPoint,
            p2: dp,
          })
        }
      }
    },
    [activeDrawingTool, visibleBars, scales, draftPoint, finishDrawing],
  )

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
    panStart.current = null
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredBar(null)
    setMouseY(null)
    isPanning.current = false
    onHoverBar?.(null)
  }, [onHoverBar])

  useEffect(() => {
    const el = chartContainerRef.current
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

  const handleGoToLatest = useCallback(() => {
    scrollToEnd()
    resetPricePan()
  }, [scrollToEnd, resetPricePan])

  const handleDoubleClick = useCallback(() => {
    fitAll()
    resetPricePan()
  }, [fitAll, resetPricePan])

  const rsiInd = indicators.find((i) => i.type === 'rsi')
  const macdInd = indicators.find((i) => i.type === 'macd')

  const hudBar = hoveredBar ?? visibleBars[visibleBars.length - 1] ?? null
  const hudInfo = useMemo(() => {
    if (!hudBar) return null
    const change = hudBar.close - hudBar.open
    const pctChange = hudBar.open !== 0 ? (change / hudBar.open) * 100 : 0
    const isPositive = change >= 0
    const colorClass = isPositive ? 'text-emerald-400' : 'text-rose-400'
    return {
      open: hudBar.open.toFixed(2),
      high: hudBar.high.toFixed(2),
      low: hudBar.low.toFixed(2),
      close: hudBar.close.toFixed(2),
      volume: hudBar.volume.toLocaleString(),
      change: (isPositive ? '+' : '') + change.toFixed(2),
      pctChange: (isPositive ? '+' : '') + pctChange.toFixed(2) + '%',
      colorClass,
    }
  }, [hudBar])

  const cursorStyle =
    activeDrawingTool === 'cursor' ? (isPanning.current ? 'grabbing' : 'crosshair') : 'crosshair'

  return (
    <div
      ref={chartContainerRef}
      className="border-carbon-700 relative h-full w-full overflow-hidden overscroll-contain rounded-lg border shadow-2xl select-none"
      style={{
        background: 'radial-gradient(circle at 50% 30%, #16273f 0%, #07101c 100%)',
      }}
    >
      {/* HUD Info Panel */}
      {hudInfo && (
        <div className="text-silver-400 bg-carbon-950/45 border-carbon-800/40 pointer-events-none absolute top-3 left-4 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-3 py-1.5 font-mono text-[11px] shadow-xl backdrop-blur-[4px]">
          <span className="text-silver-100 mr-1 font-sans text-xs font-bold tracking-wider uppercase">
            {symbol}
          </span>
          <span className="bg-brass-500/15 text-brass-400 border-brass-500/10 mr-2 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase">
            {timeframe}
          </span>
          <div>
            <span className="text-silver-500 mr-1">O</span>
            <span className="text-silver-200">{hudInfo.open}</span>
          </div>
          <div>
            <span className="text-silver-500 mr-1">H</span>
            <span className="text-silver-200">{hudInfo.high}</span>
          </div>
          <div>
            <span className="text-silver-500 mr-1">L</span>
            <span className="text-silver-200">{hudInfo.low}</span>
          </div>
          <div>
            <span className="text-silver-500 mr-1">C</span>
            <span className={hudInfo.colorClass}>{hudInfo.close}</span>
          </div>
          <div className={`${hudInfo.colorClass} font-bold`}>
            <span>{hudInfo.change}</span>
            <span className="ml-1 text-[10px]">({hudInfo.pctChange})</span>
          </div>
          <div className="hidden md:inline">
            <span className="text-silver-500 mr-1">V</span>
            <span className="text-silver-200">{hudInfo.volume}</span>
          </div>
        </div>
      )}

      {!isAtLatestCandle && (
        <div className="absolute top-2 right-3 z-10">
          <button
            type="button"
            onClick={handleGoToLatest}
            className="border-brass-500/40 bg-carbon-900/95 text-brass-400 hover:border-brass-500 hover:bg-carbon-900 flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[9px] uppercase shadow-lg"
            aria-label="Go to latest candle"
          >
            <ChevronRight className="h-3 w-3" aria-hidden />
            Latest
          </button>
        </div>
      )}

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
          hoveredTimestamp={hoveredBar?.timestamp}
        />

        <IndicatorLayer
          allBars={data}
          visibleBars={visibleBars}
          xScale={scales.xScale}
          yScale={scales.priceScale}
          indicators={indicators}
          left={CHART_MARGINS.left}
        />

        {rsiInd && layout.rsiTop !== undefined && layout.rsiHeight !== undefined && (
          <OscillatorPane
            allBars={data}
            visibleBars={visibleBars}
            xScale={scales.xScale}
            yScale={scales.rsiScale!}
            top={layout.rsiTop}
            height={layout.rsiHeight}
            left={CHART_MARGINS.left}
            type="rsi"
            config={rsiInd}
          />
        )}

        {macdInd && layout.macdTop !== undefined && layout.macdHeight !== undefined && (
          <OscillatorPane
            allBars={data}
            visibleBars={visibleBars}
            xScale={scales.xScale}
            yScale={macdScale}
            top={layout.macdTop}
            height={layout.macdHeight}
            left={CHART_MARGINS.left}
            type="macd"
            config={macdInd}
          />
        )}

        <DrawingLayer
          drawings={drawings}
          draft={draftDrawing}
          xScale={scales.xScale}
          priceScale={scales.priceScale}
          allBars={processed}
          layout={layout}
          left={CHART_MARGINS.left}
        />

        {activeDrawingTool === 'cursor' && (
          <CrosshairLayer
            activeBar={hoveredBar}
            xScale={scales.xScale}
            priceScale={scales.priceScale}
            layout={layout}
            timeframe={timeframe}
            left={CHART_MARGINS.left}
            mouseY={mouseY}
          />
        )}

        <ChartAxes
          xScale={scales.xScale}
          priceScale={scales.priceScale}
          volumeScale={scales.volumeScale}
          rsiScale={scales.rsiScale}
          macdScale={macdScale}
          layout={layout}
          timeframe={timeframe}
          left={CHART_MARGINS.left}
          bottom={CHART_MARGINS.bottom}
          height={height}
        />

        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          style={{ cursor: cursorStyle }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
        />
      </svg>
    </div>
  )
})

export const CandlestickChart = forwardRef<CandlestickChartHandle, CandlestickChartProps>(
  function CandlestickChart(props, ref) {
    const lastSize = useRef({ width: 0, height: 0 })

    if (!props.data || props.data.length === 0) {
      return (
        <div className="border-carbon-700 bg-carbon-900 text-silver-400 flex h-64 w-full items-center justify-center rounded-lg border">
          No chart data available.
        </div>
      )
    }

    return (
      <ParentSize debounceTime={50}>
        {({ width, height }) => {
          if (width > 0 && height > 0) {
            lastSize.current = { width, height }
          }
          const stableWidth = lastSize.current.width || width
          const stableHeight = lastSize.current.height || height
          if (stableWidth <= 0 || stableHeight <= 0) return null

          return <ChartInner ref={ref} {...props} width={stableWidth} height={stableHeight} />
        }}
      </ParentSize>
    )
  },
)
