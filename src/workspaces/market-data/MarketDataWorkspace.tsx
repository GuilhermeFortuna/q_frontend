import { useMemo, useState } from 'react'
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels'

import {
  useInstruments,
  useMarketSnapshot,
  useMarketSnapshots,
  useSearchSymbols,
} from '@/api/queries/market-data'
import { useProgressiveOhlcv } from '@/api/queries/useProgressiveOhlcv'
import { DEFAULT_INDICATORS } from '@/components/charts/IndicatorsPopover'
import { useDrawings } from '@/components/charts/hooks/useDrawings'
import type { DrawingTool, IndicatorConfig } from '@/components/charts/types/chart'
import { ChartPanel } from '@/components/market/ChartPanel'
import { ChartToolbar } from '@/components/market/ChartToolbar'
import { DetailZone } from '@/components/market/DetailZone'
import { DrawingRail } from '@/components/market/DrawingRail'
import { MarketWatchPanel } from '@/components/market/MarketWatchPanel'
import { QuoteRibbon } from '@/components/market/QuoteRibbon'
import { SymbolCommandPalette } from '@/components/market/SymbolCommandPalette'
import { useWatchlist } from '@/hooks/useWatchlist'
import { resolveMt5ConnectionStatus } from '@/lib/market/connectionStatus'
import { useAppStore } from '@/store/useAppStore'
import type { OhlcvBar, Instrument } from '@/types/api'

const MARKET_PANEL_IDS = ['market-watch', 'chart-zone', 'detail-zone'] as const

export function MarketDataWorkspace() {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol)
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol)

  const [selectedTimeframe, setSelectedTimeframe] = useState('1D')
  const [chartType, setChartType] = useState<'candles' | 'line' | 'area'>('candles')
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS)
  const [showGrid, setShowGrid] = useState(true)
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingTool>('cursor')
  const [hoveredBar, setHoveredBar] = useState<OhlcvBar | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [chartSearchQuery, setChartSearchQuery] = useState('')

  const leftPanelRef = usePanelRef()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'quant-market-layout',
    panelIds: [...MARKET_PANEL_IDS],
  })

  const instrumentsQuery = useInstruments()
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlist(instrumentsQuery.data)
  const watchlistSymbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist])

  const snapshotQuery = useMarketSnapshot(selectedSymbol)
  const snapshot = snapshotQuery.data
  const snapshotsQuery = useMarketSnapshots(watchlistSymbols)
  const snapshotsBySymbol = snapshotsQuery.data ?? {}
  const priceDigits = snapshot?.digits ?? 2
  const mt5Status = resolveMt5ConnectionStatus(
    snapshotQuery.isLoading,
    snapshotQuery.data,
    snapshotQuery.error,
    snapshotsQuery.error,
  )

  const chartSearchResultsQuery = useSearchSymbols(chartSearchQuery)
  const ohlcv = useProgressiveOhlcv(selectedSymbol, selectedTimeframe)
  const { drawings, setDrawings, clearDrawings } = useDrawings(selectedSymbol, selectedTimeframe)

  const selectedInstrument = instrumentsQuery.data?.find((item) => item.symbol === selectedSymbol)
  const latestBar = useMemo(() => {
    if (ohlcv.bars.length === 0) return null
    return ohlcv.bars[ohlcv.bars.length - 1]
  }, [ohlcv.bars])
  const activeBar = hoveredBar || latestBar

  const handleToggleSidebar = () => {
    const panel = leftPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) {
      panel.expand()
      setSidebarCollapsed(false)
    } else {
      panel.collapse()
      setSidebarCollapsed(true)
    }
  }

  const handleSelectSymbol = (instrument: Instrument) => {
    setSelectedSymbol(instrument.symbol)
  }

  return (
    <div className="flex h-[calc(100vh-210px)] w-full flex-col gap-4 overflow-hidden">
      <QuoteRibbon
        symbol={selectedSymbol}
        instrument={selectedInstrument}
        activeBar={activeBar}
        snapshot={snapshot}
        connectionStatus={mt5Status}
        priceDigits={priceDigits}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
      />

      <Group
        id="quant-market-layout"
        orientation="horizontal"
        defaultLayout={
          defaultLayout ?? {
            'market-watch': 20,
            'chart-zone': 80,
            'detail-zone': 0,
          }
        }
        onLayoutChanged={onLayoutChanged}
        className="min-h-0 flex-1 gap-1"
      >
        <Panel
          id="market-watch"
          panelRef={leftPanelRef}
          defaultSize={20}
          minSize={12}
          collapsible
          collapsedSize={0}
          className="min-w-0"
        >
          <MarketWatchPanel
            watchlist={watchlist}
            snapshotsBySymbol={snapshotsBySymbol}
            selectedSymbol={selectedSymbol}
            isLoadingInstruments={instrumentsQuery.isLoading}
            mt5SearchResults={chartSearchResultsQuery.data || []}
            mt5SearchLoading={chartSearchResultsQuery.isLoading}
            onSelectSymbol={setSelectedSymbol}
            onAddInstrument={addToWatchlist}
            onRemoveInstrument={removeFromWatchlist}
          />
        </Panel>

        <Separator className="market-panel-resize-handle" />

        <Panel id="chart-zone" defaultSize={80} minSize={40} className="min-w-0">
          <div className="flex h-full min-h-0 gap-4">
            <div className="quant-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg">
              <ChartToolbar
                selectedTimeframe={selectedTimeframe}
                onTimeframeChange={setSelectedTimeframe}
                chartType={chartType}
                onChartTypeChange={setChartType}
                indicators={indicators}
                onIndicatorsChange={setIndicators}
                showGrid={showGrid}
                onShowGridChange={setShowGrid}
              />
              <ChartPanel
                symbol={selectedSymbol}
                timeframe={selectedTimeframe}
                chartType={chartType}
                indicators={indicators}
                showGrid={showGrid}
                activeDrawingTool={activeDrawingTool}
                drawings={drawings}
                onDrawingsChange={setDrawings}
                bars={ohlcv.bars}
                isInitialLoading={ohlcv.isInitialLoading}
                isBackfilling={ohlcv.isBackfilling}
                isProbingRange={ohlcv.isProbingRange}
                error={ohlcv.error}
                chartRef={ohlcv.chartRef}
                onHoverBar={setHoveredBar}
                onViewportChange={ohlcv.handleViewportChange}
              />
            </div>
            <DrawingRail
              activeDrawingTool={activeDrawingTool}
              onActiveDrawingToolChange={setActiveDrawingTool}
              onClearDrawings={clearDrawings}
            />
          </div>
        </Panel>

        <Separator className="market-panel-resize-handle" />

        <Panel
          id="detail-zone"
          defaultSize={0}
          minSize={15}
          collapsible
          collapsedSize={0}
          className="min-w-0"
        >
          <DetailZone />
        </Panel>
      </Group>

      <SymbolCommandPalette
        onSelectSymbol={handleSelectSymbol}
        onAddToWatchlist={addToWatchlist}
        onSelectTimeframe={setSelectedTimeframe}
        onQueryChange={setChartSearchQuery}
      />
    </div>
  )
}
