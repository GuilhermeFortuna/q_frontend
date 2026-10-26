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
  type IndicatorConfig,
  type ChartSettings,
  type PaneLayoutPrefs,
  DEFAULT_SETTINGS,
} from '@/components/charts/types/chart'
import type { DrawingAnchor, DrawingObject, DrawingTool } from '@/components/charts/drawings/model'
import { timeMapperFromScale } from '@/components/charts/drawings/timeMapping'
import {
  useDrawingInteraction,
  type DrawingScene,
} from '@/components/charts/hooks/useDrawingInteraction'
import { magnetPrice, pixelOfAnchor } from '@/components/charts/drawings/interaction'
import { DrawingToolbar } from '@/components/charts/DrawingToolbar'
import { TextNoteEditor } from '@/components/charts/TextNoteEditor'
import { timeframeToMs, formatCrosshairLabel } from '@/lib/market/timeframes'
import { computePaneLayout } from '@/components/charts/paneLayout'
import {
  computePriceDomain,
  processBars,
  stretchScaleFactor,
  timestampAtX,
  useChartScales,
  usePriceAxis,
} from '@/components/charts/hooks/useChartScales'
import { useChartViewport } from '@/components/charts/hooks/useChartViewport'
import { CandlestickLayer } from '@/components/charts/layers/CandlestickLayer'
import { VolumeLayer } from '@/components/charts/layers/VolumeLayer'
import { GridLayer } from '@/components/charts/layers/GridLayer'
import { ChartAxes } from '@/components/charts/layers/ChartAxes'
import { ChartAxisDragHandles } from '@/components/charts/layers/ChartAxisDragHandles'
import { OscillatorPaneHandles } from '@/components/charts/layers/OscillatorPaneHandles'
import { OscillatorAxisHandles } from '@/components/charts/layers/OscillatorAxisHandles'
import {
  OscillatorHoverLayer,
  type OscillatorHoverPane,
} from '@/components/charts/layers/OscillatorHoverLayer'
import { IndicatorLayer } from '@/components/charts/layers/IndicatorLayer'
import { OscillatorPane } from '@/components/charts/layers/OscillatorPane'
import { CrosshairLayer } from '@/components/charts/layers/CrosshairLayer'
import { LastPriceLayer } from '@/components/charts/layers/LastPriceLayer'
import { DrawingLayer } from '@/components/charts/layers/DrawingLayer'
import { RulerLayer } from '@/components/charts/layers/RulerLayer'
import { measureRuler, type ChartMeasureMode } from '@/components/charts/ruler'
import { ChevronRight } from 'lucide-react'

import { useMarketIndicatorRenderModel } from '@/components/charts/hooks/useIndicatorSeries'
import { useMarketStudyRenderModel } from '@/components/charts/hooks/useStudyRenderModel'
import { mergeIndicatorRenderModels } from '@/lib/market/buildStudyRenderModel'
import { studyMarkerShape } from '@/components/charts/layers/MarkerGlyph'
import type { OhlcvBar } from '@/types/api'
import { useMarketVolumeProfileQuery } from '@/api/queries/marketIndicators'
import { volumeProfileFromIndicators } from '@/lib/market/volumeProfileConfig'
import {
  VolumeProfileLayer,
  type VolumeProfileHoverRow,
  type VolumeProfileLayerHandle,
} from '@/components/charts/layers/VolumeProfileLayer'
import { useDebounce } from '@/hooks/useDebounce'
import { formatPrice, resolvePriceFormat, type PriceFormat } from '@/lib/market/priceFormat'

const EMPTY_PANE_PREFS: PaneLayoutPrefs = {}

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
  chartSettings?: ChartSettings
  paneLayout?: PaneLayoutPrefs
  onPaneLayoutChange?: (prefs: PaneLayoutPrefs) => void
  /** Instrument precision for every price label; inferred from the bars when omitted. */
  priceFormat?: PriceFormat
  /** Snap drawing anchors and the crosshair to OHLC within 10 px, otherwise to the tick size. */
  drawingMagnet?: boolean
  /** Keep the placement tool armed after each drawing instead of returning to the cursor. */
  keepDrawingTool?: boolean
  hideAllDrawings?: boolean
  onActiveDrawingToolChange?: (tool: DrawingTool) => void
  onUndoDrawings?: () => void
  onRedoDrawings?: () => void
  /** Message about drawing persistence, shown until the next successful save. */
  drawingNotice?: string | null
}

const NO_DRAWINGS: DrawingObject[] = []
const NO_OP = () => {}

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
    drawings = NO_DRAWINGS,
    onDrawingsChange,
    onHoverBar,
    onViewportChange,
    chartSettings = DEFAULT_SETTINGS,
    paneLayout,
    onPaneLayoutChange,
    priceFormat,
    drawingMagnet = false,
    keepDrawingTool = false,
    hideAllDrawings = false,
    onActiveDrawingToolChange,
    onUndoDrawings,
    onRedoDrawings,
    drawingNotice,
  },
  ref,
) {
  const settings = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...chartSettings,
    }),
    [chartSettings],
  )
  void settings

  const processed = useMemo(() => processBars(data), [data])
  const format = useMemo(
    () => priceFormat ?? resolvePriceFormat({ bars: data }),
    [priceFormat, data],
  )
  const latestBar = processed[processed.length - 1] ?? null
  const viewportResetKey = resetKey ?? `${symbol}:${timeframe}`
  const { viewport, scrollToEnd, fitAll, zoomAt, panBy, shiftViewport, stretchXByPixels } =
    useChartViewport(processed.length, viewportResetKey)
  const {
    pricePanOffset,
    priceScaleFactor,
    resetPriceAxis,
    panPriceByPixels,
    stretchPriceByPixels,
  } = usePriceAxis(viewportResetKey)

  const viewportSlots = useMemo(
    () => buildViewportSlots(processed, viewport),
    [processed, viewport],
  )
  const visibleBars = useMemo(() => barsFromSlots(viewportSlots), [viewportSlots])
  const volumeProfile = volumeProfileFromIndicators(indicators)
  const visibleRangeSignature = useMemo(
    () =>
      visibleBars.length > 0
        ? `${visibleBars[0].timestamp}|${visibleBars[visibleBars.length - 1].timestamp}|${visibleBars.length}`
        : '',
    [visibleBars],
  )
  const debouncedVisibleSignature = useDebounce(
    visibleRangeSignature,
    volumeProfile.enabled && volumeProfile.settings.segment === 'visibleRange' ? 300 : 0,
  )
  const profileBarsRef = useRef(visibleBars)
  const barsForVolumeProfile = useMemo(() => {
    if (!volumeProfile.enabled) return visibleBars
    if (volumeProfile.settings.segment !== 'visibleRange') return data
    if (debouncedVisibleSignature !== visibleRangeSignature) {
      return profileBarsRef.current
    }
    profileBarsRef.current = visibleBars
    return visibleBars
  }, [
    data,
    debouncedVisibleSignature,
    visibleBars,
    visibleRangeSignature,
    volumeProfile.enabled,
    volumeProfile.settings.segment,
  ])
  const volumeProfileQuery = useMarketVolumeProfileQuery(
    symbol,
    volumeProfile.enabled,
    volumeProfile.settings.segment,
    timeframe,
    data,
    barsForVolumeProfile,
    volumeProfile.settings.rowTicks,
    volumeProfile.settings.valueArea,
  )

  const isViewportUnset = viewport.startIndex === 0 && viewport.endIndex === 0
  const isAtLatestCandle =
    processed.length === 0 || isViewportUnset || viewport.endIndex === processed.length - 1

  useImperativeHandle(ref, () => ({ shiftViewport, panBy, scrollToEnd }), [
    shiftViewport,
    panBy,
    scrollToEnd,
  ])

  const { model: indicatorModel, notice: indicatorNotice } = useMarketIndicatorRenderModel(
    symbol,
    timeframe,
    data,
    indicators,
  )

  const { model: studyModel, notice: studyNotice } = useMarketStudyRenderModel(
    symbol,
    timeframe,
    data,
  )
  const renderModel = useMemo(
    () => mergeIndicatorRenderModels(indicatorModel, studyModel),
    [indicatorModel, studyModel],
  )
  const volumeProfileNotice = volumeProfileQuery.data?.unavailableReason ?? null
  const indicatorNoticeText = [indicatorNotice, studyNotice, volumeProfileNotice]
    .filter(Boolean)
    .join(' ')
  const studyLegend = [
    ...renderModel.priceLines.filter((output) => output.studyName),
    ...renderModel.oscillators.flatMap((group) =>
      group.outputs.filter((output) => output.studyName),
    ),
  ]

  const oscillatorPaneKeys = useMemo(
    () => renderModel.oscillators.map((group) => group.instanceKey),
    [renderModel.oscillators],
  )

  // A drag previews its layout here; the saved preference is only written on release.
  const [paneDraft, setPaneDraft] = useState<PaneLayoutPrefs | null>(null)
  const panePrefs = paneDraft ?? paneLayout ?? EMPTY_PANE_PREFS
  const commitPaneLayout = useCallback(
    (prefs: PaneLayoutPrefs) => {
      setPaneDraft(null)
      onPaneLayoutChange?.(prefs)
    },
    [onPaneLayoutChange],
  )

  const layout = useMemo(
    () =>
      computePaneLayout(
        width,
        height,
        oscillatorPaneKeys,
        CHART_MARGINS,
        panePrefs,
        settings.showVolume,
      ),
    [width, height, oscillatorPaneKeys, panePrefs, settings.showVolume],
  )

  // Per-oscillator value-axis stretch, keyed by instance. Session state like the price axis.
  const [oscillatorScaleFactors, setOscillatorScaleFactors] = useState<Record<string, number>>({})
  useEffect(() => {
    setOscillatorScaleFactors({})
  }, [viewportResetKey])

  const scales = useChartScales(
    viewportSlots,
    layout,
    CHART_MARGINS,
    renderModel.oscillators,
    pricePanOffset,
    priceScaleFactor,
    oscillatorScaleFactors,
  )

  const oscillatorHoverPanes = useMemo<OscillatorHoverPane[]>(
    () =>
      layout.oscillators.flatMap((slot) => {
        const group = renderModel.oscillators.find((item) => item.instanceKey === slot.key)
        const scaleEntry = scales.oscillatorScales.find((item) => item.key === slot.key)
        return group && scaleEntry
          ? [{ key: slot.key, top: slot.top, height: slot.height, scale: scaleEntry.scale, group }]
          : []
      }),
    [layout.oscillators, renderModel.oscillators, scales.oscillatorScales],
  )

  const timeframeMs = useMemo(() => timeframeToMs(timeframe), [timeframe])
  const barTimes = useMemo(() => processed.map((bar) => bar.timeMs), [processed])
  const mapper = useMemo(
    () =>
      timeMapperFromScale(
        scales.xScale,
        viewport.startIndex,
        barTimes,
        timeframeMs,
        CHART_MARGINS.left,
      ),
    [scales.xScale, viewport.startIndex, barTimes, timeframeMs],
  )
  const plot = useMemo(
    () => ({
      left: CHART_MARGINS.left,
      right: CHART_MARGINS.left + layout.innerWidth,
      top: layout.priceTop,
      bottom: layout.priceTop + layout.priceHeight,
      chartTop: CHART_MARGINS.top,
      chartBottom: CHART_MARGINS.top + layout.innerHeight,
    }),
    [layout],
  )
  const formatTime = useCallback(
    (time: number) => formatCrosshairLabel(new Date(time).toISOString(), timeframe),
    [timeframe],
  )
  const scene = useMemo<DrawingScene>(
    () => ({
      mapper,
      priceScale: scales.priceScale,
      format,
      bars: processed,
      magnet: drawingMagnet,
      plot,
      formatTime,
    }),
    [mapper, scales.priceScale, format, processed, drawingMagnet, plot, formatTime],
  )
  const interaction = useDrawingInteraction({
    tool: activeDrawingTool,
    drawings,
    hideAll: hideAllDrawings,
    keepTool: keepDrawingTool,
    scene,
    onCommit: onDrawingsChange ?? NO_OP,
    onToolChange: onActiveDrawingToolChange ?? NO_OP,
    resetKey: viewportResetKey,
  })

  const [hoveredBar, setHoveredBar] = useState<(typeof visibleBars)[0] | null>(null)
  const volumeProfileLayerRef = useRef<VolumeProfileLayerHandle>(null)
  const [volumeProfileHover, setVolumeProfileHover] = useState<VolumeProfileHoverRow | null>(null)
  const [mouseY, setMouseY] = useState<number | null>(null)
  const [measureMode, setMeasureMode] = useState<ChartMeasureMode>('hand')
  const [ruler, setRuler] = useState<{ start: DrawingAnchor; end: DrawingAnchor } | null>(null)
  const rulerMeasurement = useMemo(
    () => (ruler ? measureRuler(ruler.start, ruler.end, mapper.positionOfTime) : null),
    [ruler, mapper],
  )
  const isRulerDragging = useRef(false)
  // A Ctrl press toggles the ruler only if no other key is pressed before Ctrl is released.
  const ctrlTapPending = useRef(false)
  const isPanning = useRef(false)
  const panStart = useRef<{ x: number; y: number } | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const hoverRafRef = useRef<number | null>(null)
  const pendingHoverRef = useRef<{ bar: (typeof visibleBars)[0] | null; y: number } | null>(null)

  useEffect(() => {
    onViewportChange?.(viewport)
  }, [viewport, onViewportChange])

  // A measurement is anchored to one symbol's bars and means nothing after a switch.
  useEffect(() => {
    isRulerDragging.current = false
    setRuler(null)
  }, [viewportResetKey])

  useEffect(() => {
    return () => {
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current)
      }
    }
  }, [])

  const scheduleHoverUpdate = useCallback((bar: (typeof visibleBars)[0] | null, y: number) => {
    pendingHoverRef.current = { bar, y }
    if (hoverRafRef.current !== null) return
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null
      const pending = pendingHoverRef.current
      if (!pending) return
      setHoveredBar(pending.bar)
      setMouseY(pending.y)
    })
  }, [])

  useEffect(() => {
    if (activeDrawingTool === 'cursor' && hoveredBar) {
      onHoverBar?.(hoveredBar)
    } else if (activeDrawingTool !== 'cursor') {
      onHoverBar?.(null)
    }
  }, [hoveredBar, activeDrawingTool, onHoverBar])

  const freeAnchor = (point: { x: number; y: number }): DrawingAnchor => ({
    time: mapper.timeOfX(point.x),
    price: scales.priceScale.invert(point.y),
  })

  const handleMouseMove = (event: React.MouseEvent<SVGRectElement>) => {
    const point = localPoint(event)
    if (!point) return
    const x = point.x - CHART_MARGINS.left
    const y = point.y

    if (isRulerDragging.current) {
      const end = freeAnchor(point)
      setRuler((prev) => (prev ? { ...prev, end } : prev))
    }

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

    if (!isRulerDragging.current && (activeDrawingTool !== 'cursor' || measureMode === 'hand')) {
      interaction.move(point, event.shiftKey)
    }

    setVolumeProfileHover(volumeProfileLayerRef.current?.hitTest(point.x, y) ?? null)
    const bar = timestampAtX(scales.xScale, x, visibleBars)
    scheduleHoverUpdate(bar, y)
  }

  const finishRulerDrag = useCallback(() => {
    if (!isRulerDragging.current) return
    isRulerDragging.current = false
    // A press without movement is a click on empty chart, which clears the ruler.
    setRuler((prev) =>
      prev && prev.start.time === prev.end.time && prev.start.price === prev.end.price
        ? null
        : prev,
    )
  }, [])

  const handleMouseDown = (event: React.MouseEvent<SVGRectElement>) => {
    if (event.button !== 0) return
    const point = localPoint(event)
    if (!point) return
    if (activeDrawingTool === 'cursor' && measureMode === 'ruler') {
      const start = freeAnchor(point)
      isRulerDragging.current = true
      setRuler({ start, end: start })
      return
    }
    if (interaction.press(point, event.shiftKey)) return
    if (activeDrawingTool === 'cursor') {
      isPanning.current = true
      panStart.current = { x: point.x, y: point.y }
    }
  }

  const handleMouseUp = (event: React.MouseEvent<SVGRectElement>) => {
    isPanning.current = false
    panStart.current = null
    finishRulerDrag()
    const point = localPoint(event)
    if (point) interaction.release(point, event.shiftKey)
  }

  const handleMouseLeave = useCallback(() => {
    pendingHoverRef.current = null
    if (hoverRafRef.current !== null) {
      cancelAnimationFrame(hoverRafRef.current)
      hoverRafRef.current = null
    }
    setHoveredBar(null)
    setVolumeProfileHover(null)
    setMouseY(null)
    isPanning.current = false
    finishRulerDrag()
    interaction.leave()
    onHoverBar?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHoverBar, finishRulerDrag, interaction.leave])

  // Keyboard: Delete and Escape act on drawings first; Ctrl taps and Ctrl+Z/Y never toggle the ruler.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Control') {
      if (!event.repeat) ctrlTapPending.current = true
      return
    }
    ctrlTapPending.current = false
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) onRedoDrawings?.()
        else onUndoDrawings?.()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        onRedoDrawings?.()
        return
      }
    }
    if (interaction.keyDown(event.key)) return
    if (event.key === 'Escape') {
      isRulerDragging.current = false
      setRuler(null)
    }
  }

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Control' || !ctrlTapPending.current) return
    ctrlTapPending.current = false
    if (activeDrawingTool !== 'cursor') return
    finishRulerDrag()
    setMeasureMode((mode) => (mode === 'hand' ? 'ruler' : 'hand'))
  }

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

  const stretchOscillator = useCallback((key: string, deltaY: number) => {
    setOscillatorScaleFactors((prev) => ({
      ...prev,
      [key]: stretchScaleFactor(prev[key] ?? 1, deltaY),
    }))
  }, [])

  const resetOscillator = useCallback((key: string) => {
    setOscillatorScaleFactors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const handleGoToLatest = useCallback(() => {
    scrollToEnd()
    resetPriceAxis()
    setOscillatorScaleFactors({})
  }, [scrollToEnd, resetPriceAxis])

  const handleDoubleClick = useCallback(() => {
    fitAll()
    resetPriceAxis()
    setOscillatorScaleFactors({})
  }, [fitAll, resetPriceAxis])

  const handleStretchX = useCallback(
    (deltaX: number) => {
      stretchXByPixels(deltaX, layout.innerWidth)
    },
    [stretchXByPixels, layout.innerWidth],
  )

  const hudBar = hoveredBar ?? visibleBars[visibleBars.length - 1] ?? null
  const hudInfo = useMemo(() => {
    if (!hudBar) return null
    const change = hudBar.close - hudBar.open
    const pctChange = hudBar.open !== 0 ? (change / hudBar.open) * 100 : 0
    const isPositive = change >= 0
    const colorClass = isPositive ? 'text-emerald-400' : 'text-rose-400'
    return {
      open: formatPrice(hudBar.open, format.digits),
      high: formatPrice(hudBar.high, format.digits),
      low: formatPrice(hudBar.low, format.digits),
      close: formatPrice(hudBar.close, format.digits),
      volume: hudBar.volume.toLocaleString(),
      change: (isPositive ? '+' : '') + change.toFixed(format.digits),
      pctChange: (isPositive ? '+' : '') + pctChange.toFixed(2) + '%',
      colorClass,
    }
  }, [hudBar, format.digits])

  const hiddenDrawingCount = drawings.filter((drawing) => drawing.hidden).length

  const cursorStyle =
    activeDrawingTool !== 'cursor' || measureMode === 'ruler'
      ? 'crosshair'
      : (interaction.cursor ?? (isPanning.current ? 'grabbing' : 'grab'))

  // The crosshair reads the price under the pointer, snapped to OHLC or tick size when Magnet is on.
  const crosshairPrice =
    mouseY == null
      ? null
      : drawingMagnet && hoveredBar
        ? magnetPrice(
            { x: mapper.xOfPosition(hoveredBar.index), y: mouseY },
            scales.priceScale.invert(mouseY),
            scene,
          )
        : scales.priceScale.invert(mouseY)

  return (
    <div
      ref={chartContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className="border-carbon-700 focus-visible:ring-brass-500/40 relative h-full w-full overflow-hidden overscroll-contain rounded-lg border shadow-2xl select-none focus-visible:ring-1 focus-visible:outline-none"
      style={{
        background: settings.backgroundType === 'gradient' ? settings.backgroundColor : undefined,
        backgroundColor: settings.backgroundType === 'solid' ? settings.backgroundColor : undefined,
      }}
    >
      {drawingNotice && (
        <div
          role="status"
          data-testid="chart-drawing-notice"
          className="bg-carbon-900/95 absolute bottom-14 left-3 z-10 max-w-[70%] rounded border border-amber-500/30 px-2 py-1 font-mono text-[10px] text-amber-300"
        >
          {drawingNotice}
        </div>
      )}

      {indicatorNoticeText && (
        <div
          role="status"
          data-testid="market-indicator-notice"
          className="bg-carbon-900/95 absolute bottom-8 left-3 z-10 max-w-[70%] rounded border border-rose-500/30 px-2 py-1 font-mono text-[10px] text-rose-300"
        >
          Indicators: {indicatorNoticeText}
        </div>
      )}

      {/* Top-left overlay: OHLC HUD with the study legend stacked beneath it */}
      <div className="pointer-events-none absolute top-3 left-4 z-10 flex max-w-[70%] flex-col items-start gap-1.5">
        {hudInfo && (
          <div className="text-silver-400 bg-carbon-950/80 border-carbon-800/40 pointer-events-none flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-3 py-1.5 font-mono text-[11px] shadow-xl">
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
            {volumeProfileHover && (
              <div
                className="border-carbon-700/60 flex flex-wrap gap-x-3 gap-y-0.5 border-l pl-3"
                data-testid="volume-profile-tooltip"
              >
                <span>
                  <span className="text-silver-500 mr-1">P</span>
                  <span className="text-silver-100">
                    {formatPrice(volumeProfileHover.price, format.digits)}
                  </span>
                </span>
                <span>
                  <span className="text-silver-500 mr-1">Tot</span>
                  <span className="text-silver-100">
                    {volumeProfileHover.total.toLocaleString()}
                  </span>
                </span>
                <span>
                  <span className="text-silver-500 mr-1">B</span>
                  <span className="text-emerald-400">
                    {volumeProfileHover.buy.toLocaleString()}
                  </span>
                </span>
                <span>
                  <span className="text-silver-500 mr-1">S</span>
                  <span className="text-rose-400">{volumeProfileHover.sell.toLocaleString()}</span>
                </span>
                <span>
                  <span className="text-silver-500 mr-1">U</span>
                  <span className="text-silver-200">
                    {volumeProfileHover.unknown.toLocaleString()}
                  </span>
                </span>
                <span>
                  <span className="text-silver-500 mr-1">Δ</span>
                  <span className="text-silver-100">
                    {volumeProfileHover.delta.toLocaleString()}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {studyLegend.length > 0 && (
          <div
            aria-label="Study series legend"
            className="bg-carbon-950/80 text-silver-300 flex flex-wrap gap-x-3 gap-y-1 rounded px-2 py-1 font-mono text-[9px]"
          >
            {studyLegend.map((series) => {
              const kind = series.kind ?? 'line'
              const color =
                ('color' in series ? series.color : undefined) ??
                ('config' in series ? series.config.style?.color : undefined) ??
                '#c9a227'
              return (
                <span
                  key={`${series.studyName}-${series.outputKey}`}
                  className="inline-flex items-center gap-1"
                  title={`${series.studyName} · ${series.seriesLabel ?? series.label}`}
                >
                  <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
                    {kind === 'markers' ? (
                      studyMarkerShape(
                        series.shape ?? 'circle',
                        9,
                        5,
                        Math.min(series.size ?? 6, 8),
                        color,
                      )
                    ) : kind === 'histogram' ? (
                      <rect x="7" y="1" width="5" height="8" fill={color} />
                    ) : kind === 'step' ? (
                      <path d="M1 7 H7 V3 H17" fill="none" stroke={color} strokeWidth="1.5" />
                    ) : (
                      <line x1="1" x2="17" y1="5" y2="5" stroke={color} strokeWidth="1.5" />
                    )}
                  </svg>
                  {series.seriesLabel ?? series.label}
                </span>
              )
            })}
          </div>
        )}
      </div>

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

      {hiddenDrawingCount > 0 && !hideAllDrawings && (
        <div className="absolute top-16 right-3 z-10">
          <button
            type="button"
            onClick={() =>
              onDrawingsChange?.(
                drawings.map((drawing) =>
                  drawing.hidden ? { ...drawing, hidden: false } : drawing,
                ),
              )
            }
            className="border-brass-500/40 bg-carbon-900/95 text-brass-400 hover:border-brass-500 flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[9px] uppercase shadow-lg"
          >
            Show {hiddenDrawingCount} hidden
          </button>
        </div>
      )}

      {activeDrawingTool === 'cursor' && (
        <div
          className="pointer-events-none absolute top-10 right-3 z-10"
          data-testid="chart-measure-mode"
          aria-live="polite"
        >
          <span className="bg-carbon-950/80 text-silver-400 border-carbon-800/40 rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase">
            {measureMode === 'ruler' ? 'Ruler' : 'Hand'} · Ctrl
          </span>
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
        {settings.showWatermark && layout.innerWidth > 100 && (
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

        {settings.showVolume && (
          <VolumeLayer
            visibleBars={visibleBars}
            xScale={scales.xScale}
            yScale={scales.volumeScale}
            left={CHART_MARGINS.left}
            volumeOpacity={settings.volumeOpacity}
          />
        )}

        <IndicatorLayer
          allBars={data}
          visibleBars={visibleBars}
          xScale={scales.xScale}
          yScale={scales.priceScale}
          model={renderModel}
          left={CHART_MARGINS.left}
          phase="fills"
        />

        {volumeProfile.enabled &&
        volumeProfileQuery.data &&
        volumeProfileQuery.data.segments.length > 0 ? (
          <VolumeProfileLayer
            ref={volumeProfileLayerRef}
            segments={volumeProfileQuery.data.segments}
            segmentMode={volumeProfile.settings.segment}
            allBars={processed}
            visibleBars={visibleBars}
            xScale={scales.xScale}
            yScale={scales.priceScale}
            left={CHART_MARGINS.left}
            innerWidth={layout.innerWidth}
            priceTop={layout.priceTop}
            priceHeight={layout.priceHeight}
            widthPercent={volumeProfile.settings.widthPercent}
            splitBuySell={volumeProfile.settings.splitBuySell}
            rowSize={volumeProfileQuery.data.rowSize}
          />
        ) : null}

        <CandlestickLayer
          bars={visibleBars}
          xScale={scales.xScale}
          yScale={scales.priceScale}
          chartType={chartType}
          left={CHART_MARGINS.left}
          candleOpacity={settings.candleOpacity}
        />

        <IndicatorLayer
          allBars={data}
          visibleBars={visibleBars}
          xScale={scales.xScale}
          yScale={scales.priceScale}
          model={renderModel}
          left={CHART_MARGINS.left}
          phase="overlays"
        />

        {layout.oscillators.map((slot) => {
          const group = renderModel.oscillators.find((item) => item.instanceKey === slot.key)
          const scaleEntry = scales.oscillatorScales.find((item) => item.key === slot.key)
          if (!group || !scaleEntry) return null
          return (
            <OscillatorPane
              key={group.instanceKey}
              allBars={data}
              visibleBars={visibleBars}
              xScale={scales.xScale}
              yScale={scaleEntry.scale}
              top={slot.top}
              height={slot.height}
              left={CHART_MARGINS.left}
              group={group}
            />
          )
        })}

        <OscillatorHoverLayer
          bar={hoveredBar}
          mouseY={activeDrawingTool === 'cursor' ? mouseY : null}
          panes={oscillatorHoverPanes}
          left={CHART_MARGINS.left}
          innerWidth={layout.innerWidth}
        />

        <DrawingLayer
          placed={interaction.placed}
          draft={interaction.draft}
          selectedId={interaction.selectedId}
          hoveredId={interaction.hoveredId}
          plot={plot}
          width={width}
        />

        {ruler && rulerMeasurement && (
          <RulerLayer
            start={ruler.start}
            end={ruler.end}
            measurement={rulerMeasurement}
            mapper={mapper}
            priceScale={scales.priceScale}
            layout={layout}
            left={CHART_MARGINS.left}
            digits={format.digits}
          />
        )}

        <LastPriceLayer
          price={latestBar?.close ?? null}
          isBullish={latestBar?.isBullish ?? true}
          priceScale={scales.priceScale}
          layout={layout}
          left={CHART_MARGINS.left}
          width={width}
          digits={format.digits}
        />

        <CrosshairLayer
          activeBar={hoveredBar}
          xScale={scales.xScale}
          priceScale={scales.priceScale}
          layout={layout}
          timeframe={timeframe}
          left={CHART_MARGINS.left}
          width={width}
          mouseY={mouseY}
          price={crosshairPrice}
          digits={format.digits}
        />

        <ChartAxes
          xScale={scales.xScale}
          priceScale={scales.priceScale}
          volumeScale={scales.volumeScale}
          oscillatorScales={scales.oscillatorScales}
          layout={layout}
          timeframe={timeframe}
          priceDigits={format.digits}
          showVolume={settings.showVolume}
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
          disabled={activeDrawingTool !== 'cursor'}
        />

        <rect
          data-testid="chart-interaction"
          x={CHART_MARGINS.left}
          y={CHART_MARGINS.top}
          width={layout.innerWidth}
          height={layout.innerHeight}
          fill="transparent"
          style={{ cursor: cursorStyle }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={(event) => {
            const point = localPoint(event)
            if (point && interaction.doubleClick(point)) return
            handleDoubleClick()
          }}
        />

        <OscillatorPaneHandles
          layout={layout}
          margins={CHART_MARGINS}
          prefs={panePrefs}
          onPreview={setPaneDraft}
          onCommit={commitPaneLayout}
          disabled={activeDrawingTool !== 'cursor'}
        />

        <OscillatorAxisHandles
          oscillators={layout.oscillators}
          margins={CHART_MARGINS}
          innerWidth={layout.innerWidth}
          onStretch={stretchOscillator}
          onReset={resetOscillator}
          disabled={activeDrawingTool !== 'cursor'}
        />
      </svg>

      {interaction.selected && interaction.selectedGeometry && (
        <DrawingToolbar
          drawing={interaction.selected}
          handles={interaction.selectedGeometry.handles}
          containerWidth={width}
          containerHeight={height}
          onUpdate={interaction.updateSelected}
          onToggleHidden={() =>
            interaction.updateSelected((drawing) => ({ ...drawing, hidden: true }) as DrawingObject)
          }
          onDelete={interaction.deleteSelected}
        />
      )}

      {interaction.editing && (
        <TextNoteEditor
          key={interaction.editing.id ?? 'new-note'}
          x={pixelOfAnchor(interaction.editing.anchor, scene).x}
          y={pixelOfAnchor(interaction.editing.anchor, scene).y}
          initialText={interaction.editing.text}
          onCommit={interaction.commitText}
          onCancel={interaction.cancelText}
        />
      )}
    </div>
  )
})

export const CandlestickChart = forwardRef<CandlestickChartHandle, CandlestickChartProps>(
  function CandlestickChart(props, ref) {
    const lastSize = useRef({ width: 0, height: 0 })

    const settings = {
      ...DEFAULT_SETTINGS,
      ...props.chartSettings,
    }

    const bgStyle =
      settings.backgroundType === 'gradient'
        ? { background: settings.backgroundColor }
        : { backgroundColor: settings.backgroundColor }

    if (!props.data || props.data.length === 0) {
      return (
        <div
          className="border-carbon-700 text-silver-400 flex h-64 w-full items-center justify-center rounded-lg border"
          style={bgStyle}
        >
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

          return (
            <ChartInner
              ref={ref}
              {...props}
              chartSettings={settings}
              width={stableWidth}
              height={stableHeight}
            />
          )
        }}
      </ParentSize>
    )
  },
)
