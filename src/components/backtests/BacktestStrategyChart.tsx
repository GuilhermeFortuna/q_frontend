import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { localPoint } from '@visx/event'

import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import {
  StrategyIndicatorLayer,
  StrategyOscillatorLayer,
} from '@/components/backtests/StrategyIndicatorLayer'
import { TradeMarkersLayer } from '@/components/backtests/TradeMarkersLayer'
import { processBars } from '@/components/charts/hooks/useChartScales'
import { useChartViewport } from '@/components/charts/hooks/useChartViewport'
import { CandlestickLayer } from '@/components/charts/layers/CandlestickLayer'
import { ChartAxes } from '@/components/charts/layers/ChartAxes'
import { GridLayer } from '@/components/charts/layers/GridLayer'
import { VolumeLayer } from '@/components/charts/layers/VolumeLayer'
import { CHART_MARGINS } from '@/components/charts/types/chart'
import type { ChartIndicatorSeries, Trade } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

export type BacktestStrategyChartProps = {
  bars: OhlcvBar[]
  indicators: ChartIndicatorSeries[]
  trades: Trade[]
  symbol: string
  timeframe?: string
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
}: BacktestStrategyChartProps & { width: number; height: number }) {
  const processed = useMemo(() => processBars(bars), [bars])
  const hasOscillator = indicators.some((ind) => ind.pane === 'oscillator')
  const layout = useMemo(
    () => computeBacktestLayout(width, height, hasOscillator),
    [width, height, hasOscillator],
  )
  const { viewport, resetViewport, fitAll, zoomAt, panBy } = useChartViewport(processed.length)
  const visibleBars = useMemo(
    () => processed.slice(viewport.startIndex, viewport.endIndex + 1),
    [processed, viewport],
  )
  const visibleTimestamps = useMemo(
    () => new Set(visibleBars.map((bar) => bar.timestamp)),
    [visibleBars],
  )

  const scales = useMemo(() => {
    const domain = visibleBars.map((b) => b.timestamp)
    const xScale = scaleBand<string>({
      domain,
      range: [0, layout.innerWidth],
      padding: 0.25,
    })

    const priceMin = Math.min(...visibleBars.map((b) => b.low))
    const priceMax = Math.max(...visibleBars.map((b) => b.high))
    const pricePad = (priceMax - priceMin) * 0.08 || 1

    const priceScale = scaleLinear<number>({
      domain: [priceMin - pricePad, priceMax + pricePad],
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
  }, [visibleBars, layout, indicators])

  const isPanning = useRef(false)
  const panStart = useRef<{ x: number; startIndex: number } | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

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
      if (!point || !isPanning.current || !panStart.current) return

      const barDelta = Math.round(
        (point.x - panStart.current.x) / Math.max(scales.xScale.step(), 4),
      )
      if (barDelta !== 0) {
        panBy(-barDelta)
        panStart.current = { x: point.x, startIndex: viewport.startIndex }
      }
    },
    [panBy, scales.xScale, viewport.startIndex],
  )

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      if (event.button !== 0) return
      const point = localPoint(event)
      if (!point) return
      isPanning.current = true
      panStart.current = { x: point.x, startIndex: viewport.startIndex }
    },
    [viewport.startIndex],
  )

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
    panStart.current = null
  }, [])

  const handleDoubleClick = useCallback(() => {
    fitAll()
  }, [fitAll])

  return (
    <div
      ref={chartRef}
      className="border-carbon-700 relative h-full w-full overflow-hidden overscroll-contain rounded-lg border shadow-2xl"
      style={{
        background: 'radial-gradient(circle at 50% 30%, #16273f 0%, #07101c 100%)',
      }}
    >
      <div className="text-silver-400 absolute top-2 left-3 z-10 font-mono text-[10px] uppercase">
        {symbol} · {timeframe}
      </div>
      <button
        type="button"
        onClick={resetViewport}
        className="border-carbon-700 bg-carbon-900/80 text-silver-400 hover:border-brass-500 hover:text-brass-400 absolute top-2 right-3 z-10 rounded border px-2 py-0.5 font-mono text-[9px] uppercase"
        aria-label="Reset chart view"
      >
        Reset
      </button>

      <svg width={width} height={height}>
        <GridLayer
          xScale={scales.xScale}
          yScale={scales.priceScale}
          width={layout.innerWidth}
          height={layout.priceHeight}
          top={layout.priceTop}
          left={CHART_MARGINS.left}
        />

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
          chartType="candles"
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

        <TradeMarkersLayer
          trades={trades}
          allBars={bars}
          visibleTimestamps={visibleTimestamps}
          xScale={scales.xScale}
          yScale={scales.priceScale}
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

        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          style={{ cursor: isPanning.current ? 'grabbing' : 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        />
      </svg>
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
        <span className="inline-block h-0 w-0 border-r-4 border-b-[6px] border-l-4 border-r-transparent border-b-emerald-400 border-l-transparent" />
        Long entry
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0 w-0 border-t-[6px] border-r-4 border-l-4 border-t-rose-400 border-r-transparent border-l-transparent" />
        Short entry
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="border-silver-400 inline-block h-2.5 w-2.5 rounded-full border" />
        Exit
      </span>
      <span className="text-silver-500">
        Scroll to zoom · drag to pan · double-click to fit all
      </span>
    </div>
  )
}

export function BacktestStrategyChart(props: BacktestStrategyChartProps) {
  const lastSize = useRef({ width: 0, height: 0 })

  if (props.bars.length === 0) {
    return <ChartEmptyState message="No price data available for this backtest." />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="relative min-h-0 flex-1">
        <ParentSize className="absolute inset-0" debounceTime={50}>
          {({ width, height }) => {
            if (width > 0 && height > 0) {
              lastSize.current = { width, height }
            }
            const stableWidth = lastSize.current.width || width
            const stableHeight = lastSize.current.height || height
            if (stableWidth <= 0 || stableHeight <= 0) return null

            return <ChartInner {...props} width={stableWidth} height={stableHeight} />
          }}
        </ParentSize>
      </div>
      <ChartLegend indicators={props.indicators} />
    </div>
  )
}
