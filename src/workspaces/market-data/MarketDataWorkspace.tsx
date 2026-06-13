import { useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels'

import {
  useInstruments,
  useMarketSnapshot,
  useMarketSnapshots,
  useSearchSymbols,
} from '@/api/queries/market-data'
import { useProgressiveOhlcv } from '@/api/queries/useProgressiveOhlcv'
import { useDrawings } from '@/components/charts/hooks/useDrawings'

import { ChartPanel } from '@/components/market/ChartPanel'
import { ChartToolbar } from '@/components/market/ChartToolbar'
import { DetailZone } from '@/components/market/DetailZone'
import { DrawingRail } from '@/components/market/DrawingRail'
import { MarketWatchPanel } from '@/components/market/MarketWatchPanel'
import { QuoteRibbon } from '@/components/market/QuoteRibbon'
import { SymbolCommandPalette } from '@/components/market/SymbolCommandPalette'
import { useWatchlist } from '@/hooks/useWatchlist'
import { useRecentSymbols } from '@/hooks/useRecentSymbols'
import { resolveMt5ConnectionStatus } from '@/lib/market/connectionStatus'
import { useAppStore } from '@/store/useAppStore'
import type { OhlcvBar, Instrument } from '@/types/api'

const MARKET_PANEL_IDS = ['market-watch', 'chart-zone', 'detail-zone'] as const

export function MarketDataWorkspace() {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol)
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol)

  const {
    selectedTimeframe,
    chartType,
    indicators,
    showGrid,
    chartSettings,
    activeDrawingTool,
    sidebarCollapsed,
  } = useAppStore((s) => s.marketDataSession)
  const patchMarketDataSession = useAppStore((s) => s.patchMarketDataSession)

  const [hoveredBar, setHoveredBar] = useState<OhlcvBar | null>(null)
  const [chartSearchQuery, setChartSearchQuery] = useState('')

  const leftPanelRef = usePanelRef()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'quant-market-layout',
    panelIds: [...MARKET_PANEL_IDS],
  })

  const instrumentsQuery = useInstruments()
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlist(instrumentsQuery.data)
  const { recentSymbols, recordSymbol } = useRecentSymbols()
  const watchlistSymbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist])

  useEffect(() => {
    if (selectedSymbol) {
      recordSymbol(selectedSymbol)
    }
  }, [recordSymbol, selectedSymbol])

  const recentInstruments = useMemo(() => {
    const catalog = instrumentsQuery.data ?? []
    const fromCatalog = recentSymbols
      .map((symbol) => catalog.find((item) => item.symbol === symbol))
      .filter((item): item is Instrument => item !== undefined)

    const fromWatchlist = recentSymbols
      .map((symbol) => watchlist.find((item) => item.symbol === symbol))
      .filter((item): item is Instrument => item !== undefined)

    const merged = new Map<string, Instrument>()
    for (const instrument of [...fromWatchlist, ...fromCatalog]) {
      merged.set(instrument.symbol, instrument)
    }

    return recentSymbols
      .map((symbol) => merged.get(symbol))
      .filter((item): item is Instrument => item !== undefined)
  }, [instrumentsQuery.data, recentSymbols, watchlist])

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
    } else {
      panel.collapse()
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
        isLoadingInstrument={instrumentsQuery.isLoading}
        onToggleSidebar={handleToggleSidebar}
      />

      <Group
        id="quant-market-layout"
        orientation="horizontal"
        defaultLayout={
          defaultLayout ?? {
            'market-watch': 20,
            'chart-zone': 60,
            'detail-zone': 20,
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
          onResize={(size) => {
            const isCollapsed = size.asPercentage === 0
            if (isCollapsed !== sidebarCollapsed) {
              patchMarketDataSession({ sidebarCollapsed: isCollapsed })
            }
          }}
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

        <Panel id="chart-zone" defaultSize={60} minSize={40} className="min-w-0">
          <div className="flex h-full min-h-0 gap-4">
            <div className="quant-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg">
              <ChartToolbar
                selectedTimeframe={selectedTimeframe}
                onTimeframeChange={(val) => patchMarketDataSession({ selectedTimeframe: val })}
                chartType={chartType}
                onChartTypeChange={(val) => patchMarketDataSession({ chartType: val })}
                indicators={indicators}
                onIndicatorsChange={(val) => patchMarketDataSession({ indicators: val })}
                showGrid={showGrid}
                onShowGridChange={(val) => patchMarketDataSession({ showGrid: val })}
                chartSettings={chartSettings}
                onChartSettingsChange={(val) => patchMarketDataSession({ chartSettings: val })}
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
                tickTime={snapshot?.tickTime ?? null}
                chartRef={ohlcv.chartRef}
                onHoverBar={setHoveredBar}
                onViewportChange={ohlcv.handleViewportChange}
                chartSettings={chartSettings}
              />
            </div>
            <DrawingRail
              activeDrawingTool={activeDrawingTool}
              onActiveDrawingToolChange={(val) =>
                patchMarketDataSession({ activeDrawingTool: val })
              }
              onClearDrawings={clearDrawings}
            />
          </div>
        </Panel>

        <Separator className="market-panel-resize-handle" />

        <Panel
          id="detail-zone"
          defaultSize={20}
          minSize={15}
          collapsible
          collapsedSize={0}
          className="min-w-0"
        >
          <DetailZone symbol={selectedSymbol} snapshot={snapshot} />
        </Panel>
      </Group>

      <SymbolCommandPalette
        onSelectSymbol={handleSelectSymbol}
        onAddToWatchlist={addToWatchlist}
        onRemoveFromWatchlist={removeFromWatchlist}
        onSelectTimeframe={(val) => patchMarketDataSession({ selectedTimeframe: val })}
        onQueryChange={setChartSearchQuery}
        recentInstruments={recentInstruments}
      />
    </div>
  )
}
