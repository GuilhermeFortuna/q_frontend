import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  MousePointer,
  Minus,
  Type,
  Eraser,
  TrendingUp,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import {
  isMt5OfflineError,
  useInstruments,
  useMarketSnapshot,
  useMarketSnapshots,
  useSearchSymbols,
} from '@/api/queries/market-data'
import { useProgressiveOhlcv } from '@/api/queries/useProgressiveOhlcv'
import { CandlestickChart } from '@/components/charts/CandlestickChart'
import { FlashOnChange } from '@/components/shared/FlashOnChange'
import { DEFAULT_INDICATORS, IndicatorsPopover } from '@/components/charts/IndicatorsPopover'
import { useDrawings } from '@/components/charts/hooks/useDrawings'
import type { DrawingTool, IndicatorConfig } from '@/components/charts/types/chart'
import { formatPrice } from '@/lib/market/format'
import { CHART_TIMEFRAMES } from '@/lib/market/timeframes'
import { useAppStore } from '@/store/useAppStore'
import type { OhlcvBar, Instrument } from '@/types/api'

type Mt5ConnectionStatus = 'live' | 'offline' | 'connecting'

function resolveMt5ConnectionStatus(
  snapshotLoading: boolean,
  snapshotData: unknown,
  snapshotError: unknown,
  snapshotsError: unknown,
): Mt5ConnectionStatus {
  if (snapshotLoading && !snapshotData) {
    return 'connecting'
  }
  if (isMt5OfflineError(snapshotError) || isMt5OfflineError(snapshotsError)) {
    return 'offline'
  }
  return 'live'
}

function parseTimeframeInput(input: string): { label: string; value: string } | null {
  const clean = input.trim().toLowerCase()

  // Matches "60 min", "60m", "60 minutes", etc.
  const minMatch = clean.match(/^(\d+)\s*(min|m|minutes?)$/)
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10)
    if (mins === 1) return { label: 'Switch to 1 Minute', value: '1m' }
    if (mins === 5) return { label: 'Switch to 5 Minutes', value: '5m' }
    if (mins === 15) return { label: 'Switch to 15 Minutes', value: '15m' }
    if (mins === 30) return { label: 'Switch to 30 Minutes', value: '30m' }
    if (mins === 60) return { label: 'Switch to 1 Hour', value: '1H' }
    if (mins === 240) return { label: 'Switch to 4 Hours', value: '4H' }
  }

  // Matches "1h", "1 h", "1 hour", etc.
  const hourMatch = clean.match(/^(\d+)\s*(h|hours?)$/)
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10)
    if (hours === 1) return { label: 'Switch to 1 Hour', value: '1H' }
    if (hours === 4) return { label: 'Switch to 4 Hours', value: '4H' }
  }

  // Matches "1d", "1 d", "1 day", "daily", etc.
  const dayMatch = clean.match(/^(\d+)\s*(d|days?)$/) || (clean === 'daily' ? [null, '1'] : null)
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10)
    if (days === 1) return { label: 'Switch to 1 Day (Daily)', value: '1D' }
  }

  // Direct matches
  if (clean === '1m') return { label: 'Switch to 1 Minute', value: '1m' }
  if (clean === '5m') return { label: 'Switch to 5 Minutes', value: '5m' }
  if (clean === '15m') return { label: 'Switch to 15 Minutes', value: '15m' }
  if (clean === '30m') return { label: 'Switch to 30 Minutes', value: '30m' }
  if (clean === '1h' || clean === '60m') return { label: 'Switch to 1 Hour', value: '1H' }
  if (clean === '4h' || clean === '240m') return { label: 'Switch to 4 Hours', value: '4H' }
  if (clean === '1d' || clean === 'daily') return { label: 'Switch to 1 Day (Daily)', value: '1D' }

  // Generic numeric input (default to minutes)
  const numMatch = clean.match(/^(\d+)$/)
  if (numMatch) {
    const num = parseInt(numMatch[1], 10)
    if (num === 1) return { label: 'Switch to 1 Minute', value: '1m' }
    if (num === 5) return { label: 'Switch to 5 Minutes', value: '5m' }
    if (num === 15) return { label: 'Switch to 15 Minutes', value: '15m' }
    if (num === 30) return { label: 'Switch to 30 Minutes', value: '30m' }
    if (num === 60) return { label: 'Switch to 1 Hour', value: '1H' }
    if (num === 240) return { label: 'Switch to 4 Hours', value: '4H' }
  }

  return null
}

export function MarketDataWorkspace() {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol)
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol)

  // 1. Local Timeframe state (needed before useOhlcv query)
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D')

  // 2. Local Watchlist State (synced with localStorage)
  const [watchlist, setWatchlist] = useState<Instrument[]>(() => {
    const saved = localStorage.getItem('quant_watchlist')
    return saved ? JSON.parse(saved) : []
  })

  const watchlistSymbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist])

  // 3. Fetch live metrics from queries
  const instrumentsQuery = useInstruments()
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
  const ohlcv = useProgressiveOhlcv(selectedSymbol, selectedTimeframe)
  const ohlcvData = ohlcv.bars

  useEffect(() => {
    const saved = localStorage.getItem('quant_watchlist')
    if (!saved && instrumentsQuery.data) {
      setWatchlist(instrumentsQuery.data)
      localStorage.setItem('quant_watchlist', JSON.stringify(instrumentsQuery.data))
    }
  }, [instrumentsQuery.data])

  const handleAddToWatchlist = (inst: Instrument) => {
    if (watchlist.some((w) => w.symbol === inst.symbol)) return
    const newWatchlist = [...watchlist, inst]
    setWatchlist(newWatchlist)
    localStorage.setItem('quant_watchlist', JSON.stringify(newWatchlist))
  }

  const handleRemoveFromWatchlist = (symbol: string) => {
    const newWatchlist = watchlist.filter((w) => w.symbol !== symbol)
    setWatchlist(newWatchlist)
    localStorage.setItem('quant_watchlist', JSON.stringify(newWatchlist))
  }

  // 3. Local Terminal Settings State
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chartType, setChartType] = useState<'candles' | 'line' | 'area'>('candles')
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS)
  const [showGrid, setShowGrid] = useState(true)
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingTool>('cursor')
  const [hoveredBar, setHoveredBar] = useState<OhlcvBar | null>(null)
  const { drawings, setDrawings, clearDrawings } = useDrawings(selectedSymbol, selectedTimeframe)

  // 4. Chart Keyboard Search Overlay State
  const [chartSearchOpen, setChartSearchOpen] = useState(false)
  const [chartSearchQuery, setChartSearchQuery] = useState('')
  const [chartSelectedIndex, setChartSelectedIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const chartSearchResultsQuery = useSearchSymbols(chartSearchQuery)
  const chartSearchResults = chartSearchResultsQuery.data || []

  // Check if search query matches a timeframe command
  const parsedTimeframe = useMemo(() => {
    return parseTimeframeInput(chartSearchQuery)
  }, [chartSearchQuery])

  // Combine timeframe actions and symbol results in a single dropdown list
  const dropdownItems = useMemo(() => {
    const items: Array<
      { type: 'timeframe'; label: string; value: string } | { type: 'symbol'; symbol: Instrument }
    > = []

    if (parsedTimeframe) {
      items.push({
        type: 'timeframe',
        label: parsedTimeframe.label,
        value: parsedTimeframe.value,
      })
    }

    chartSearchResults.forEach((inst) => {
      items.push({
        type: 'symbol',
        symbol: inst,
      })
    })

    return items
  }, [parsedTimeframe, chartSearchResults])

  // Listen for keyboard input when chart has focus (not inside an input element)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Check for alphanumeric keys, space (to allow timeframe spaces), or standard MT5 symbol chars like $, @
      const isAlphanumericOrSpace = /^[a-zA-Z0-9$@\s]$/.test(e.key)
      if (isAlphanumericOrSpace && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setChartSearchOpen(true)
        setChartSearchQuery(e.key === ' ' ? '' : e.key)
        setChartSelectedIndex(0)
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Auto-focus search overlay input when it opens
  useEffect(() => {
    if (chartSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
      // Move cursor to the end
      const val = searchInputRef.current.value
      searchInputRef.current.value = ''
      searchInputRef.current.value = val
    }
  }, [chartSearchOpen])

  // Handle outside click to close search overlay
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (chartSearchOpen && overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setChartSearchOpen(false)
        setChartSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [chartSearchOpen])

  const selectSearchResult = (inst: Instrument) => {
    handleAddToWatchlist(inst)
    setSelectedSymbol(inst.symbol)
    setChartSearchOpen(false)
    setChartSearchQuery('')
  }

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setChartSearchOpen(false)
      setChartSearchQuery('')
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      setChartSelectedIndex((prev) => Math.min(prev + 1, dropdownItems.length - 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setChartSelectedIndex((prev) => Math.max(prev - 1, 0))
      e.preventDefault()
    } else if (e.key === 'Enter') {
      const selectedItem = dropdownItems[chartSelectedIndex]
      if (selectedItem) {
        if (selectedItem.type === 'timeframe') {
          setSelectedTimeframe(selectedItem.value)
          setChartSearchOpen(false)
          setChartSearchQuery('')
        } else {
          selectSearchResult(selectedItem.symbol)
        }
      }
      e.preventDefault()
    }
  }

  // Filter instruments based on search bar
  const filteredInstruments = useMemo(() => {
    return watchlist.filter(
      (inst) =>
        inst.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [watchlist, searchQuery])

  // Get active price/volume coordinates (hovered or latest)
  const latestBar = useMemo(() => {
    if (ohlcvData.length === 0) return null
    return ohlcvData[ohlcvData.length - 1]
  }, [ohlcvData])

  const activeBar = hoveredBar || latestBar

  return (
    <div className="flex h-[calc(100vh-210px)] w-full flex-col gap-4 overflow-hidden">
      {/* 1. Monospace Ribbon / Dynamic OHLC Header */}
      <div className="border-carbon-700/60 flex flex-wrap items-center justify-between gap-4 border-b pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="border-carbon-700 bg-carbon-800 text-silver-300 hover:bg-carbon-700 flex h-8 w-8 items-center justify-center rounded border transition-all active:scale-95"
            title="Toggle Market Watch Panel"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-silver-100 font-mono text-xl font-bold tracking-tight">
                {selectedSymbol}
              </h1>
              <span className="bg-carbon-800 text-silver-400 border-carbon-700 rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase">
                {instrumentsQuery.data?.find((i) => i.symbol === selectedSymbol)?.exchange || 'MT5'}
              </span>
              {mt5Status === 'live' && (
                <span className="flex items-center gap-1 font-mono text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live
                </span>
              )}
              {mt5Status === 'offline' && (
                <span className="flex items-center gap-1 font-mono text-[10px] font-semibold tracking-wider text-rose-400 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  MT5 Offline
                </span>
              )}
              {mt5Status === 'connecting' && (
                <span className="text-silver-400 flex animate-pulse items-center gap-1 font-mono text-[10px] font-semibold tracking-wider uppercase">
                  <span className="bg-silver-400 h-1.5 w-1.5 rounded-full" />
                  Connecting…
                </span>
              )}
            </div>
            <p className="text-silver-400 text-xs">
              {instrumentsQuery.data?.find((i) => i.symbol === selectedSymbol)?.name ||
                'Loading details…'}
            </p>
          </div>
        </div>

        {/* Dynamic Ticker displaying prices of hovered bar, or latest closed session */}
        <div className="flex items-center gap-6">
          <div className="border-carbon-700/60 bg-carbon-900/80 text-silver-400 flex flex-wrap items-center gap-x-4 gap-y-1 rounded border px-3 py-1.5 font-mono text-xs">
            <div>
              <span className="text-silver-400 text-[10px] font-semibold">O</span>{' '}
              <span className="text-silver-200">
                {activeBar ? formatPrice(activeBar.open, priceDigits) : '—'}
              </span>
            </div>
            <div>
              <span className="text-silver-400 text-[10px] font-semibold">H</span>{' '}
              <span className="text-emerald-400">
                {activeBar ? formatPrice(activeBar.high, priceDigits) : '—'}
              </span>
            </div>
            <div>
              <span className="text-silver-400 text-[10px] font-semibold">L</span>{' '}
              <span className="text-rose-400">
                {activeBar ? formatPrice(activeBar.low, priceDigits) : '—'}
              </span>
            </div>
            <div>
              <span className="text-silver-400 text-[10px] font-semibold">C</span>{' '}
              <span
                className={
                  activeBar && activeBar.close >= activeBar.open
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }
              >
                {activeBar ? formatPrice(activeBar.close, priceDigits) : '—'}
              </span>
            </div>
            <div className="border-carbon-700 mx-1 hidden h-3 border-l sm:block" />
            <div className="hidden sm:block">
              <span className="text-silver-400 text-[10px] font-semibold">VOL</span>{' '}
              <span className="text-silver-200">
                {activeBar ? activeBar.volume.toLocaleString() : '—'}
              </span>
            </div>
          </div>

          {/* Quick price change percentage stats */}
          {snapshot && (
            <div className="border-carbon-800 flex items-center gap-3 border-l pl-4">
              <div className="text-right">
                <FlashOnChange value={snapshot.last}>
                  <p className="text-silver-100 font-mono text-base font-bold">
                    {formatPrice(snapshot.last, priceDigits)}
                  </p>
                </FlashOnChange>
                <p
                  className={`font-mono text-xs font-medium ${
                    snapshot.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {snapshot.changePct >= 0 ? '▲ +' : '▼ '}
                  {snapshot.changePct.toFixed(2)}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Terminal Grid Layout */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        {/* Side panel: COLLAPSIBLE Market Watch */}
        {sidebarOpen && (
          <div className="quant-panel flex w-[280px] shrink-0 flex-col overflow-hidden rounded-lg transition-all duration-300">
            <div className="border-carbon-700 border-b p-3">
              <p className="text-silver-300 mb-2 text-xs font-semibold tracking-wider uppercase">
                Market Watch
              </p>
              <div className="relative">
                <Search className="text-silver-400 absolute top-2.5 left-2.5 h-3.5 w-3.5" />
                <input
                  type="text"
                  placeholder="Filter symbols..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-carbon-700 bg-carbon-900 text-silver-100 placeholder-silver-400 focus:border-brass-500 focus:ring-brass-500/20 w-full rounded border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {instrumentsQuery.isLoading && watchlist.length === 0 ? (
                <div className="text-silver-400 flex h-32 items-center justify-center text-xs">
                  Loading assets…
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* Watchlist Section */}
                  {filteredInstruments.length > 0 ? (
                    filteredInstruments.map((inst) => {
                      const isSelected = inst.symbol === selectedSymbol
                      const rowSnap = snapshotsBySymbol[inst.symbol]
                      const rowDigits = rowSnap?.digits ?? 2

                      return (
                        <div
                          key={inst.symbol}
                          onClick={() => setSelectedSymbol(inst.symbol)}
                          className={`group border-carbon-800/40 relative flex cursor-pointer items-center justify-between border-b px-3.5 py-2.5 transition-all select-none ${
                            isSelected
                              ? 'bg-brass-600/10 border-l-brass-500 text-silver-100 border-l-2 shadow-[inset_1px_0_0_rgba(196,165,116,0.1)]'
                              : 'hover:bg-carbon-800/40 text-silver-300'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`font-mono text-sm font-bold ${
                                isSelected ? 'text-brass-400' : 'text-silver-200'
                              }`}
                            >
                              {inst.symbol}
                            </span>
                            <span className="text-silver-400 line-clamp-1 max-w-[120px] text-[10px]">
                              {inst.name}
                            </span>
                          </div>
                          <div className="text-right transition-all duration-200 group-hover:pr-6">
                            {rowSnap ? (
                              <>
                                <FlashOnChange
                                  value={rowSnap.last}
                                  className="text-silver-200 block font-mono text-xs font-semibold"
                                >
                                  {formatPrice(rowSnap.last, rowDigits)}
                                </FlashOnChange>
                                <span
                                  className={`font-mono text-[10px] ${
                                    rowSnap.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {rowSnap.changePct >= 0 ? '+' : ''}
                                  {rowSnap.changePct.toFixed(2)}%
                                </span>
                                <span className="text-silver-400 block font-mono text-[10px]">
                                  {formatPrice(rowSnap.bid, rowDigits)} /{' '}
                                  {formatPrice(rowSnap.ask, rowDigits)}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-silver-400 block font-mono text-xs font-semibold">
                                  —
                                </span>
                                <span className="text-silver-500 font-mono text-[10px]">—</span>
                              </>
                            )}
                          </div>

                          {/* Hover Remove Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveFromWatchlist(inst.symbol)
                            }}
                            className="bg-carbon-700/80 text-silver-400 absolute top-1/2 right-2.5 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded transition-all group-hover:flex hover:text-rose-400 active:scale-90"
                            title="Remove from watchlist"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })
                  ) : searchQuery.trim() === '' ? (
                    <div className="text-silver-400 flex h-32 items-center justify-center text-xs">
                      No assets in watchlist.
                    </div>
                  ) : (
                    <div className="text-silver-500 flex h-16 items-center justify-center text-xs italic">
                      No local matches.
                    </div>
                  )}

                  {/* MetaTrader Search Results in Sidebar */}
                  {searchQuery.trim().length > 1 && (
                    <div className="border-carbon-700/60 mt-3 border-t pt-3">
                      <p className="text-brass-400 mb-2 px-3.5 text-[10px] font-bold tracking-wider uppercase">
                        MetaTrader Search
                      </p>
                      {chartSearchResultsQuery.isLoading ? (
                        <div className="text-silver-400 flex h-16 items-center justify-center font-mono text-xs">
                          Searching MT5…
                        </div>
                      ) : chartSearchResults.length > 0 ? (
                        chartSearchResults
                          .filter((s) => !watchlist.some((w) => w.symbol === s.symbol))
                          .map((inst) => (
                            <div
                              key={inst.symbol}
                              onClick={() => {
                                selectSearchResult(inst)
                                setSearchQuery('')
                              }}
                              className="border-carbon-800/40 hover:bg-carbon-800/40 text-silver-300 flex cursor-pointer items-center justify-between border-b px-3.5 py-2 transition-all"
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="text-silver-200 font-mono text-xs font-bold">
                                  {inst.symbol}
                                </span>
                                <span className="text-silver-400 line-clamp-1 max-w-[150px] text-[9px]">
                                  {inst.name}
                                </span>
                              </div>
                              <span className="bg-carbon-800 border-carbon-700/60 text-brass-400 hover:text-brass-300 rounded border px-2 py-0.5 font-mono text-[9px] uppercase">
                                + Add
                              </span>
                            </div>
                          ))
                      ) : (
                        <div className="text-silver-500 px-3.5 py-2 font-mono text-xs">
                          No matches in MT5.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Center panel: Advanced Chart Terminal */}
        <div className="quant-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg transition-all">
          {/* Terminal control bar */}
          <div className="border-carbon-700 bg-carbon-800/80 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
            {/* Timeframe selector (Mock buttons showing selected state) */}
            <div className="bg-carbon-900 border-carbon-700/50 flex items-center gap-1 rounded border p-0.5">
              {CHART_TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`rounded px-2 py-1 font-mono text-[10px] font-bold transition-all ${
                    selectedTimeframe === tf
                      ? 'bg-brass-500 text-carbon-950 shadow'
                      : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-800'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Styling options toolbar */}
            <div className="flex items-center gap-4 text-xs">
              {/* Chart Style Toggle */}
              <div className="border-carbon-700 flex items-center gap-1.5 border-r pr-4">
                <span className="text-silver-400 text-[10px] font-semibold tracking-wider uppercase">
                  Style
                </span>
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as 'candles' | 'line' | 'area')}
                  className="border-carbon-700 bg-carbon-900 text-silver-200 focus:border-brass-500 rounded border px-2 py-0.5 text-xs outline-none"
                >
                  <option value="candles">Candles</option>
                  <option value="line">Line</option>
                  <option value="area">Area</option>
                </select>
              </div>

              <IndicatorsPopover indicators={indicators} onChange={setIndicators} />

              {/* Grid Toggle */}
              <label className="flex cursor-pointer items-center gap-1.5 select-none">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="border-carbon-700 text-brass-500 accent-brass-500 cursor-pointer rounded focus:ring-0"
                />
                <span className="text-silver-300 text-[10px] font-bold tracking-wider uppercase">
                  Grid
                </span>
              </label>
            </div>
          </div>

          {/* Chart panel body */}
          <div className="relative min-h-0 flex-1 p-3">
            {(ohlcv.isBackfilling || ohlcv.isProbingRange) && ohlcvData.length > 0 && (
              <div className="text-brass-400 bg-carbon-950/80 border-brass-500/30 pointer-events-none absolute top-5 left-5 z-10 rounded border px-2 py-1 font-mono text-[10px] tracking-wide">
                Loading history…
              </div>
            )}
            {ohlcv.isInitialLoading ? (
              <div className="border-carbon-700 bg-carbon-900/40 text-silver-400 flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border">
                <Activity className="text-brass-500 h-8 w-8 animate-pulse" />
                <span className="font-mono text-sm">Loading market candles…</span>
              </div>
            ) : ohlcvData.length > 0 ? (
              <CandlestickChart
                ref={ohlcv.chartRef}
                data={ohlcvData}
                symbol={selectedSymbol}
                timeframe={selectedTimeframe}
                resetKey={`${selectedSymbol}:${selectedTimeframe}`}
                showGrid={showGrid}
                chartType={chartType}
                indicators={indicators}
                activeDrawingTool={activeDrawingTool}
                drawings={drawings}
                onDrawingsChange={setDrawings}
                onHoverBar={setHoveredBar}
                onViewportChange={ohlcv.handleViewportChange}
              />
            ) : (
              <div className="border-carbon-700 bg-carbon-900/40 flex h-full w-full items-center justify-center rounded-lg border text-rose-300">
                {ohlcv.error
                  ? ohlcv.error.message
                  : `Failed to load historical data for ${selectedSymbol}.`}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Sleek Technical Drawing Sidebar */}
        <div className="quant-panel bg-carbon-800/80 flex w-[44px] shrink-0 flex-col items-center gap-3 rounded-lg py-4">
          <div className="text-silver-400 mb-1 text-[9px] font-semibold tracking-wider uppercase select-none">
            Draw
          </div>

          <button
            onClick={() => setActiveDrawingTool('cursor')}
            className={`flex h-8 w-8 items-center justify-center rounded transition-all ${
              activeDrawingTool === 'cursor'
                ? 'bg-brass-500 text-carbon-950 scale-105 shadow'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-700/60'
            }`}
            title="Crosshair Cursor Pointer"
          >
            <MousePointer className="h-4 w-4" />
          </button>

          <button
            onClick={() => setActiveDrawingTool('trendline')}
            className={`flex h-8 w-8 items-center justify-center rounded transition-all ${
              activeDrawingTool === 'trendline'
                ? 'bg-brass-500 text-carbon-950 scale-105 shadow'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-700/60'
            }`}
            title="Draw Trendline"
          >
            <TrendingUp className="h-4 w-4" />
          </button>

          <button
            onClick={() => setActiveDrawingTool('horizontal')}
            className={`flex h-8 w-8 items-center justify-center rounded transition-all ${
              activeDrawingTool === 'horizontal'
                ? 'bg-brass-500 text-carbon-950 scale-105 shadow'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-700/60'
            }`}
            title="Draw Support/Resistance Line"
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            onClick={() => setActiveDrawingTool('fibo')}
            className={`flex h-8 w-8 items-center justify-center rounded transition-all ${
              activeDrawingTool === 'fibo'
                ? 'bg-brass-500 text-carbon-950 scale-105 shadow'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-700/60'
            }`}
            title="Draw Fibonacci Retracements"
          >
            <Layers className="h-4 w-4" />
          </button>

          <button
            onClick={() => setActiveDrawingTool('text')}
            className={`flex h-8 w-8 items-center justify-center rounded transition-all ${
              activeDrawingTool === 'text'
                ? 'bg-brass-500 text-carbon-950 scale-105 shadow'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-700/60'
            }`}
            title="Insert Text Annotation"
          >
            <Type className="h-4 w-4" />
          </button>

          <div className="border-carbon-700 my-2 w-8 border-t" />

          <button
            onClick={() => {
              clearDrawings()
              setActiveDrawingTool('cursor')
            }}
            className="text-silver-400 hover:bg-carbon-700/60 flex h-8 w-8 items-center justify-center rounded transition-all hover:text-red-400 active:scale-90"
            title="Clear all drawings"
            aria-label="Clear all drawings"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* TradingView-style Symbol Search Overlay */}
      {chartSearchOpen && (
        <div className="bg-carbon-950/60 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div
            ref={overlayRef}
            className="quant-panel bg-carbon-900 border-brass-500/30 flex max-h-[400px] w-[480px] flex-col overflow-hidden rounded-xl border shadow-2xl"
          >
            {/* Header / Input */}
            <div className="border-carbon-700/60 bg-carbon-800/80 flex items-center gap-3 border-b p-4">
              <Search className="text-brass-400 h-4 w-4" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search symbol..."
                value={chartSearchQuery}
                onChange={(e) => {
                  setChartSearchQuery(e.target.value)
                  setChartSelectedIndex(0)
                }}
                onKeyDown={handleSearchInputKeyDown}
                className="text-silver-100 placeholder-silver-400 flex-1 bg-transparent font-mono text-base outline-none"
              />
              <span className="border-carbon-600 bg-carbon-900 text-silver-400 rounded border px-1.5 py-0.5 font-mono text-[10px]">
                ESC to exit
              </span>
            </div>

            {/* Results List */}
            <div className="min-h-[150px] flex-1 overflow-y-auto p-2">
              {chartSearchQuery.trim() === '' ? (
                <div className="text-silver-400 flex h-32 items-center justify-center font-mono text-xs">
                  Start typing to search symbols or switch timeframes…
                </div>
              ) : chartSearchResultsQuery.isLoading && dropdownItems.length === 0 ? (
                <div className="text-silver-400 flex h-32 flex-col items-center justify-center gap-2 font-mono text-xs">
                  <Activity className="text-brass-500 h-6 w-6 animate-pulse" />
                  <span>Searching MetaTrader terminal…</span>
                </div>
              ) : dropdownItems.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {dropdownItems.map((item, index) => {
                    const isActive = index === chartSelectedIndex
                    if (item.type === 'timeframe') {
                      return (
                        <div
                          key={`tf-${item.value}`}
                          onClick={() => {
                            setSelectedTimeframe(item.value)
                            setChartSearchOpen(false)
                            setChartSearchQuery('')
                          }}
                          onMouseEnter={() => setChartSelectedIndex(index)}
                          className={`flex cursor-pointer items-center justify-between rounded px-3 py-2 font-mono text-xs transition-all select-none ${
                            isActive
                              ? 'bg-brass-500/20 text-brass-300 border-l-brass-500 border-l-2 font-semibold'
                              : 'text-silver-300 hover:bg-carbon-800'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-silver-100 flex items-center gap-1.5 text-sm font-bold">
                              <span className="bg-brass-400 inline-block h-1.5 w-1.5 rounded-full"></span>
                              {item.label}
                            </span>
                          </div>
                          <span className="bg-carbon-950 border-carbon-700 text-brass-400 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase">
                            Timeframe Action
                          </span>
                        </div>
                      )
                    } else {
                      const inst = item.symbol
                      return (
                        <div
                          key={`sym-${inst.symbol}`}
                          onClick={() => selectSearchResult(inst)}
                          onMouseEnter={() => setChartSelectedIndex(index)}
                          className={`flex cursor-pointer items-center justify-between rounded px-3 py-2 font-mono text-xs transition-all select-none ${
                            isActive
                              ? 'bg-brass-500/20 text-brass-300 border-l-brass-500 border-l-2 font-semibold'
                              : 'text-silver-300 hover:bg-carbon-800'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-silver-100 text-sm font-bold">{inst.symbol}</span>
                            <span className="text-silver-400 line-clamp-1 max-w-[300px] text-[10px]">
                              {inst.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            <span className="bg-carbon-950 border-carbon-700 text-silver-400 rounded border px-1.5 py-0.5 text-[10px] uppercase">
                              {inst.exchange}
                            </span>
                            <span className="bg-carbon-950 border-carbon-700 text-silver-400 rounded border px-1.5 py-0.5 text-[10px] capitalize">
                              {inst.assetClass}
                            </span>
                          </div>
                        </div>
                      )
                    }
                  })}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center font-mono text-xs text-rose-300">
                  No matches found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
