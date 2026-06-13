import { useEffect, useMemo, useState, useCallback } from 'react'
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels'

import {
  useInstruments,
  useMarketSnapshot,
  useMarketSnapshots,
  useSearchSymbols,
} from '@/api/queries/market-data'
import { useProgressiveOhlcv } from '@/api/queries/useProgressiveOhlcv'
import { useDrawings } from '@/components/charts/hooks/useDrawings'
import { DEFAULT_SETTINGS, type ChartProfile } from '@/components/charts/types/chart'

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

const DEFAULT_PROFILES: ChartProfile[] = [
  {
    id: 'profile-clean',
    name: 'Limpo',
    chartType: 'candles',
    showGrid: true,
    indicators: [],
    chartSettings: DEFAULT_SETTINGS,
  },
  {
    id: 'profile-ma',
    name: 'MA Crossover',
    chartType: 'candles',
    showGrid: true,
    indicators: [
      {
        type: 'sma',
        enabled: true,
        period: 20,
        color: '#c9a227',
        strokeWidth: 1.5,
        lineStyle: 'solid',
      },
      {
        type: 'ema',
        enabled: true,
        period: 9,
        color: '#26a69a',
        strokeWidth: 1.5,
        lineStyle: 'solid',
      },
    ],
    chartSettings: DEFAULT_SETTINGS,
  },
  {
    id: 'profile-bollinger',
    name: 'Bollinger Bands',
    chartType: 'candles',
    showGrid: true,
    indicators: [
      {
        type: 'bollinger',
        enabled: true,
        period: 20,
        stdDev: 2,
        color: '#6eb5ff',
        strokeWidth: 1.2,
        showCloud: true,
      },
    ],
    chartSettings: DEFAULT_SETTINGS,
  },
]

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
    detailCollapsed,
  } = useAppStore((s) => s.marketDataSession)
  const patchMarketDataSession = useAppStore((s) => s.patchMarketDataSession)

  const [profiles, setProfiles] = useState<ChartProfile[]>(() => {
    const raw = localStorage.getItem('quant:chart-profiles')
    if (raw) {
      try {
        return JSON.parse(raw)
      } catch {
        // Fall back to default
      }
    }
    return DEFAULT_PROFILES
  })

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    const savedActive = localStorage.getItem('quant:active-chart-profile-id')
    return savedActive || 'profile-clean'
  })

  useEffect(() => {
    // Sync active profile settings to Zustand on mount
    const active = profiles.find((p) => p.id === activeProfileId)
    if (active) {
      patchMarketDataSession({
        chartType: active.chartType,
        showGrid: active.showGrid,
        indicators: active.indicators,
        chartSettings: active.chartSettings,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateActiveProfile = useCallback(
    (updates: Partial<Omit<ChartProfile, 'id' | 'name'>>) => {
      setProfiles((prev) => {
        const next = prev.map((p) => (p.id === activeProfileId ? { ...p, ...updates } : p))
        localStorage.setItem('quant:chart-profiles', JSON.stringify(next))
        return next
      })
    },
    [activeProfileId],
  )

  const handleSelectProfile = useCallback(
    (id: string) => {
      setActiveProfileId(id)
      localStorage.setItem('quant:active-chart-profile-id', id)
      const prof = profiles.find((p) => p.id === id)
      if (prof) {
        patchMarketDataSession({
          chartType: prof.chartType,
          showGrid: prof.showGrid,
          indicators: prof.indicators,
          chartSettings: prof.chartSettings,
        })
      }
    },
    [profiles, patchMarketDataSession],
  )

  const handleAddProfile = useCallback(() => {
    const name = window.prompt('Enter new profile name:', `Profile ${profiles.length + 1}`)
    if (!name || !name.trim()) return

    const newId = `profile-${Date.now()}`
    const active = profiles.find((p) => p.id === activeProfileId) || profiles[0]
    const newProfile: ChartProfile = {
      id: newId,
      name: name.trim(),
      chartType: active.chartType,
      showGrid: active.showGrid,
      indicators: [...active.indicators],
      chartSettings: { ...active.chartSettings },
    }

    const next = [...profiles, newProfile]
    setProfiles(next)
    localStorage.setItem('quant:chart-profiles', JSON.stringify(next))
    handleSelectProfile(newId)
  }, [profiles, activeProfileId, handleSelectProfile])

  const handleDeleteProfile = useCallback(
    (id: string, event: React.MouseEvent | React.KeyboardEvent) => {
      event.stopPropagation()
      if (profiles.length <= 1) {
        alert('You must keep at least one profile.')
        return
      }

      const index = profiles.findIndex((p) => p.id === id)
      const next = profiles.filter((p) => p.id !== id)
      setProfiles(next)
      localStorage.setItem('quant:chart-profiles', JSON.stringify(next))

      if (activeProfileId === id) {
        const fallbackIndex = Math.max(0, index - 1)
        const fallbackProfile = next[fallbackIndex]
        handleSelectProfile(fallbackProfile.id)
      }
    },
    [profiles, activeProfileId, handleSelectProfile],
  )

  const [hoveredBar, setHoveredBar] = useState<OhlcvBar | null>(null)
  const [chartSearchQuery, setChartSearchQuery] = useState('')

  const leftPanelRef = usePanelRef()
  const rightPanelRef = usePanelRef()
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

  const handleToggleDetailPanel = () => {
    const panel = rightPanelRef.current
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
        detailCollapsed={detailCollapsed}
        isLoadingInstrument={instrumentsQuery.isLoading}
        onToggleSidebar={handleToggleSidebar}
        onToggleDetailPanel={handleToggleDetailPanel}
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
                onChartTypeChange={(val) => {
                  patchMarketDataSession({ chartType: val })
                  updateActiveProfile({ chartType: val })
                }}
                indicators={indicators}
                onIndicatorsChange={(val) => {
                  patchMarketDataSession({ indicators: val })
                  updateActiveProfile({ indicators: val })
                }}
                showGrid={showGrid}
                onShowGridChange={(val) => {
                  patchMarketDataSession({ showGrid: val })
                  updateActiveProfile({ showGrid: val })
                }}
                chartSettings={chartSettings}
                onChartSettingsChange={(val) => {
                  patchMarketDataSession({ chartSettings: val })
                  updateActiveProfile({ chartSettings: val })
                }}
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
                profiles={profiles}
                activeProfileId={activeProfileId}
                onSelectProfile={handleSelectProfile}
                onAddProfile={handleAddProfile}
                onDeleteProfile={handleDeleteProfile}
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
          panelRef={rightPanelRef}
          defaultSize={20}
          minSize={15}
          collapsible
          collapsedSize={0}
          className="min-w-0"
          onResize={(size) => {
            const isCollapsed = size.asPercentage === 0
            if (isCollapsed !== detailCollapsed) {
              patchMarketDataSession({ detailCollapsed: isCollapsed })
            }
          }}
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
