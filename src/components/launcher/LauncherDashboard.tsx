import { useEffect, useState, useMemo, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import {
  BarChart3,
  Cpu,
  Database,
  HardDrive,
  GripHorizontal,
  Maximize2,
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Edit2,
  Check,
  Trash2,
  Newspaper,
  Search,
  X,
} from 'lucide-react'

import { useMarketSnapshots, useInstruments, useSearchSymbols } from '@/api/queries/market-data'
import { useSystemHealth } from '@/api/queries/system'
import { useBacktestHistory } from '@/api/queries/backtests'
import { useActiveJobs } from '@/hooks/useActiveJobs'
import { useSparklines } from '@/hooks/useSparklines'
import { FlashOnChange } from '@/components/shared/FlashOnChange'
import { closesToPath, sparklineStrokeColor } from '@/lib/market/sparkline'
import { isTauri } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { mockArticles } from '@/mocks/news'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

const DEFAULT_SYMBOLS = ['BTCUSD', 'EURUSD', 'PETR4', 'VALE3']
const LOCAL_STORAGE_KEY = 'quant-dashboard-symbols'
const PANEL_LAYOUT_STORAGE_KEY = 'quant-launcher-panel-layouts'
const PANEL_MIN_WIDTH = 320
const PANEL_MIN_HEIGHT = 360

type PanelKey = 'market' | 'system'

type PanelLayout = {
  x: number
  y: number
  width: number
  height: number
}

type PanelLayouts = Record<PanelKey, PanelLayout>

function getDefaultPanelLayouts(containerWidth = 0): PanelLayouts {
  const width = 360
  const height = 790
  const rightX = Math.max(containerWidth - width, 0)

  return {
    market: { x: 0, y: 0, width, height },
    system: { x: rightX, y: 0, width, height },
  }
}

function readStoredPanelLayouts(): Partial<PanelLayouts> {
  try {
    const stored = localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function clampPanelLayout(layout: PanelLayout, container: DOMRectReadOnly | null): PanelLayout {
  const maxWidth = Math.max(PANEL_MIN_WIDTH, container?.width ?? layout.width)
  const maxHeight = Math.max(PANEL_MIN_HEIGHT, container?.height ?? layout.height)
  const width = Math.min(Math.max(layout.width, PANEL_MIN_WIDTH), maxWidth)
  const height = Math.min(Math.max(layout.height, PANEL_MIN_HEIGHT), maxHeight)
  const maxX = Math.max((container?.width ?? width) - width, 0)
  const maxY = Math.max((container?.height ?? height) - height, 0)

  return {
    x: Math.min(Math.max(layout.x, 0), maxX),
    y: Math.min(Math.max(layout.y, 0), maxY),
    width,
    height,
  }
}

// Simple Sparkline component using shared sparkline helpers
function MiniSparkline({
  closes,
  width = 80,
  height = 24,
}: {
  closes?: number[]
  width?: number
  height?: number
}) {
  const path = useMemo(
    () => (closes ? closesToPath(closes, width, height) : ''),
    [closes, width, height],
  )
  const stroke = useMemo(
    () => (closes ? sparklineStrokeColor(closes) : 'var(--color-silver-400)'),
    [closes],
  )

  if (!path) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1}
        />
      </svg>
    )
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

type FloatingLauncherPanelProps = {
  children: ReactNode
  className?: string
  containerRef: RefObject<HTMLDivElement | null>
  layout: PanelLayout
  panel: PanelKey
  setLayout: (panel: PanelKey, layout: PanelLayout) => void
}

function FloatingLauncherPanel({
  children,
  className,
  containerRef,
  layout,
  panel,
  setLayout,
}: FloatingLauncherPanelProps) {
  const dragStartRef = useRef<{
    layout: PanelLayout
    pointerX: number
    pointerY: number
    mode: 'drag' | 'resize'
  } | null>(null)

  const updateFromPointer = (clientX: number, clientY: number) => {
    const start = dragStartRef.current
    if (!start) return

    const deltaX = clientX - start.pointerX
    const deltaY = clientY - start.pointerY
    const containerRect = containerRef.current?.getBoundingClientRect() ?? null

    const next =
      start.mode === 'drag'
        ? {
            ...start.layout,
            x: start.layout.x + deltaX,
            y: start.layout.y + deltaY,
          }
        : {
            ...start.layout,
            width: start.layout.width + deltaX,
            height: start.layout.height + deltaY,
          }

    setLayout(panel, clampPanelLayout(next, containerRect))
  }

  const startInteraction =
    (mode: 'drag' | 'resize') => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      dragStartRef.current = {
        layout,
        pointerX: event.clientX,
        pointerY: event.clientY,
        mode,
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateFromPointer(moveEvent.clientX, moveEvent.clientY)
      }

      const handleMouseUp = () => {
        dragStartRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

  return (
    <motion.div
      initial={{ opacity: 0, x: panel === 'market' ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'quant-panel bg-espresso-950/45 absolute z-30 flex flex-col overflow-hidden rounded-2xl backdrop-blur-xl',
        className,
      )}
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
      }}
    >
      <button
        type="button"
        aria-label={`Move ${panel} panel`}
        title="Drag panel"
        onMouseDown={startInteraction('drag')}
        className="border-brass-600/20 bg-carbon-950/70 text-silver-400 hover:text-brass-400 hover:border-brass-500/40 absolute top-2 left-1/2 z-20 flex h-6 w-10 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full border shadow-lg active:cursor-grabbing"
      >
        <GripHorizontal className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`Resize ${panel} panel`}
        title="Resize panel"
        onMouseDown={startInteraction('resize')}
        className="border-brass-600/20 bg-carbon-950/70 text-silver-400 hover:text-brass-400 hover:border-brass-500/40 absolute top-2 right-12 z-20 flex h-6 w-6 cursor-nwse-resize touch-none items-center justify-center rounded-full border shadow-lg"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      {children}
      <button
        type="button"
        aria-label={`Resize ${panel} panel from corner`}
        title="Resize panel"
        onMouseDown={startInteraction('resize')}
        className="border-brass-500/30 absolute right-1.5 bottom-1.5 z-20 h-5 w-5 cursor-nwse-resize touch-none rounded-br-xl border-r-2 border-b-2 opacity-70 transition-opacity hover:opacity-100"
      />
    </motion.div>
  )
}

export function LauncherDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const layoutsInitializedRef = useRef(false)
  const [panelLayouts, setPanelLayouts] = useState<PanelLayouts>(() => getDefaultPanelLayouts())

  // Load symbols from localStorage or use defaults
  const [symbols, setSymbols] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      return stored ? JSON.parse(stored) : DEFAULT_SYMBOLS
    } catch {
      return DEFAULT_SYMBOLS
    }
  })

  const [isEditing, setIsEditing] = useState(false)

  const snapshotsQuery = useMarketSnapshots(symbols)
  const snapshots = snapshotsQuery.data ?? {}
  const sparklines = useSparklines(symbols)
  const { data: health } = useSystemHealth()
  const activeJobs = useActiveJobs()

  // For adding new symbols
  const instrumentsQuery = useInstruments()
  const allInstruments = useMemo(() => instrumentsQuery.data ?? [], [instrumentsQuery.data])

  const [searchQuery, setSearchQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const searchResultsQuery = useSearchSymbols(searchQuery)
  const searchResults = useMemo(() => searchResultsQuery.data ?? [], [searchResultsQuery.data])

  const updatePanelLayout = (panel: PanelKey, layout: PanelLayout) => {
    setPanelLayouts((current) => {
      const next = { ...current, [panel]: layout }
      localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    const node = dashboardRef.current
    if (!node) return

    const syncLayoutsToContainer = () => {
      const containerRect = node.getBoundingClientRect()
      setPanelLayouts((current) => {
        const defaults = getDefaultPanelLayouts(containerRect.width)
        const source = layoutsInitializedRef.current
          ? current
          : {
              market: { ...defaults.market, ...readStoredPanelLayouts().market },
              system: { ...defaults.system, ...readStoredPanelLayouts().system },
            }
        layoutsInitializedRef.current = true
        const next = {
          market: clampPanelLayout(source.market, containerRect),
          system: clampPanelLayout(source.system, containerRect),
        }
        localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    }

    syncLayoutsToContainer()
    const observer = new ResizeObserver(syncLayoutsToContainer)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Filter out instruments already in the watchlist
  const availableDefaultInstruments = useMemo(() => {
    return allInstruments.filter((inst) => !symbols.includes(inst.symbol))
  }, [allInstruments, symbols])

  const availableSearchResults = useMemo(() => {
    return searchResults.filter((inst) => !symbols.includes(inst.symbol))
  }, [searchResults, symbols])

  const displayInstruments = useMemo(() => {
    if (searchQuery.trim().length <= 1) {
      return availableDefaultInstruments
    }
    return availableSearchResults
  }, [searchQuery, availableDefaultInstruments, availableSearchResults])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Fetch recent simulations
  const historyQuery = useBacktestHistory({ limit: 3 })
  const recentRuns = historyQuery.data?.items ?? []

  // Simulated live system resources metrics
  const [cpu, setCpu] = useState(24)
  const [ram, setRam] = useState(48.2)
  const [io, setIo] = useState(8.4)

  useEffect(() => {
    const interval = setInterval(() => {
      setCpu((prev) => Math.max(10, Math.min(95, +(prev + (Math.random() - 0.5) * 6).toFixed(1))))
      setRam((prev) => Math.max(40, Math.min(80, +(prev + (Math.random() - 0.5) * 0.4).toFixed(2))))
      setIo((prev) => Math.max(2, Math.min(45, +(prev + (Math.random() - 0.5) * 2).toFixed(1))))
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const runningJobsCount = Object.keys(activeJobs).length

  const handleAddSymbol = (symbolToAdd: string) => {
    if (!symbolToAdd || symbols.includes(symbolToAdd)) return
    const nextSymbols = [...symbols, symbolToAdd]
    setSymbols(nextSymbols)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextSymbols))
  }

  const handleRemoveSymbol = (symbolToRemove: string) => {
    const nextSymbols = symbols.filter((s) => s !== symbolToRemove)
    setSymbols(nextSymbols)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextSymbols))
  }

  const handleResetDefaults = () => {
    setSymbols(DEFAULT_SYMBOLS)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_SYMBOLS))
  }

  const openArticleInBrowser = (url: string) => {
    const opened = window.open(url, '_blank', 'width=780,height=620')
    if (!opened) {
      window.location.assign(url)
    }
  }

  const handleOpenArticle = (id: string) => {
    const url = `/?news_id=${encodeURIComponent(id)}`

    if (isTauri()) {
      try {
        const readerWindow = new WebviewWindow(`news-${id}-${Date.now()}`, {
          url,
          title: 'Quant News Reader',
          width: 780,
          height: 620,
          resizable: true,
          decorations: false,
          focus: true,
        })
        void readerWindow.once('tauri://error', (event) => {
          console.error('Failed to open Tauri news reader window:', event.payload)
        })
        return
      } catch (err) {
        console.error('Failed to open Tauri news reader window:', err)
        return
      }
    }

    openArticleInBrowser(url)
  }

  return (
    <div
      ref={dashboardRef}
      className="relative h-[min(790px,calc(100vh-220px))] w-full overflow-hidden"
    >
      {/* Left Sidebar - Market Tickers & Recent Simulations */}
      <FloatingLauncherPanel
        className="gap-4 p-4"
        containerRef={dashboardRef}
        layout={panelLayouts.market}
        panel="market"
        setLayout={updatePanelLayout}
      >
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="text-brass-400 h-4.5 w-4.5" />
            <h2 className="text-silver-100 text-xs font-semibold tracking-wider uppercase">
              Market Monitor
            </h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                'ml-auto flex items-center justify-center rounded-lg border p-1.5 transition-all duration-150',
                isEditing
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-carbon-800/80 bg-carbon-900/40 text-silver-400 hover:text-brass-400 hover:border-brass-600/30',
              )}
              title={isEditing ? 'Done editing' : 'Edit symbols'}
            >
              {isEditing ? <Check className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
            </button>
          </div>
          <p className="text-silver-400 mt-1 text-[11px]">
            {isEditing
              ? 'Add or remove tracked symbols.'
              : 'Real-time symbol tracking and sparklines.'}
          </p>
        </div>

        {/* Tracked Symbols List */}
        <div className="flex max-h-[260px] flex-col gap-3 overflow-y-auto pr-1">
          {symbols.length > 0 ? (
            symbols.map((symbol) => {
              const snapshot = snapshots[symbol]
              const price = snapshot?.last
              const change = snapshot?.changePct ?? 0
              const isPositive = change >= 0
              const closes = sparklines[symbol]

              return (
                <div
                  key={symbol}
                  className="bg-carbon-900/35 border-carbon-800/60 hover:border-brass-600/30 flex items-center justify-between rounded-xl border p-3 transition-all duration-200"
                >
                  <div className="flex flex-col">
                    <span className="text-silver-100 font-mono text-xs font-bold tracking-tight">
                      {symbol}
                    </span>
                    <span className="text-silver-500 text-[10px] font-medium tracking-wider uppercase">
                      {symbol.toLowerCase().includes('usd')
                        ? 'Crypto'
                        : symbol.toLowerCase().includes('eur')
                          ? 'Forex'
                          : 'Equity'}
                    </span>
                  </div>

                  {isEditing ? (
                    <button
                      onClick={() => handleRemoveSymbol(symbol)}
                      className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-1.5 text-rose-400 transition-colors hover:bg-rose-500/20"
                      title={`Remove ${symbol}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-20 items-center justify-center">
                        <MiniSparkline closes={closes} />
                      </div>

                      <div className="flex flex-col items-end">
                        <FlashOnChange
                          value={price}
                          className="text-silver-100 font-mono text-xs font-semibold tabular-nums"
                        >
                          {price != null
                            ? price.toLocaleString('en-US', {
                                minimumFractionDigits: snapshot?.digits ?? 2,
                              })
                            : '—'}
                        </FlashOnChange>
                        <span
                          className={cn(
                            'flex items-center gap-0.5 font-mono text-[10px] font-bold tabular-nums',
                            isPositive ? 'text-emerald-400' : 'text-rose-400',
                          )}
                        >
                          {isPositive ? (
                            <TrendingUp className="h-2.5 w-2.5" />
                          ) : (
                            <TrendingDown className="h-2.5 w-2.5" />
                          )}
                          {change > 0 ? '+' : ''}
                          {change.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="border-carbon-800/40 flex flex-col items-center justify-center rounded-xl border border-dashed py-6 text-center">
              <BarChart3 className="text-silver-500 mb-1.5 h-6 w-6 animate-pulse opacity-30" />
              <span className="text-silver-400 font-mono text-[10px] tracking-wider uppercase">
                Watchlist Empty
              </span>
              <span className="text-silver-500 mt-0.5 text-[9px]">Add symbols in edit mode.</span>
            </div>
          )}
        </div>

        {/* Edit mode controls */}
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-carbon-900/20 border-carbon-800/60 flex flex-col gap-2 rounded-xl border p-3"
          >
            <span className="text-silver-400 font-mono text-[10px] font-bold tracking-wider uppercase">
              Add Symbol
            </span>
            <div className="relative" ref={dropdownRef}>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Search MT5 symbols..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setIsFocused(true)
                  }}
                  onFocus={() => setIsFocused(true)}
                  className="border-carbon-700 bg-carbon-900 text-silver-200 focus:ring-brass-500/50 placeholder-silver-500 w-full rounded-lg border py-1.5 pr-7 pl-7 font-mono text-xs focus:ring-1 focus:outline-none"
                />
                <Search className="text-silver-500 absolute left-2.5 h-3.5 w-3.5" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-silver-500 hover:text-silver-300 absolute right-2.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Dropdown list */}
              {isFocused && (
                <div className="border-carbon-800 bg-carbon-950/95 absolute right-0 left-0 z-50 mt-1 flex max-h-[160px] scrollbar-thin flex-col gap-0.5 overflow-y-auto rounded-lg border p-1 shadow-2xl backdrop-blur-md">
                  {searchQuery.trim().length > 1 && searchResultsQuery.isLoading && (
                    <div className="text-silver-400 flex items-center justify-center gap-1.5 px-2 py-3 text-center font-mono text-[9px]">
                      <RefreshCw className="text-brass-500 h-3 w-3 animate-spin" />
                      Searching MT5...
                    </div>
                  )}

                  {searchQuery.trim().length > 1 &&
                    !searchResultsQuery.isLoading &&
                    displayInstruments.length === 0 && (
                      <div className="px-2 py-3 text-center font-mono text-[9px] text-rose-400">
                        No symbols found.
                      </div>
                    )}

                  {searchQuery.trim().length <= 1 && displayInstruments.length === 0 && (
                    <div className="text-silver-500 px-2 py-3 text-center font-mono text-[9px]">
                      All default symbols added.
                    </div>
                  )}

                  {displayInstruments.map((inst) => (
                    <button
                      key={inst.symbol}
                      onClick={() => {
                        handleAddSymbol(inst.symbol)
                        setSearchQuery('')
                        setIsFocused(false)
                      }}
                      className="hover:bg-brass-500/10 text-silver-200 hover:text-brass-400 hover:border-brass-500/20 flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left font-mono text-[11px] transition-colors"
                    >
                      <div className="flex min-w-0 flex-1 flex-col pr-2">
                        <span className="text-silver-100 truncate font-bold">{inst.symbol}</span>
                        <span className="text-silver-500 truncate text-[9px]">{inst.name}</span>
                      </div>
                      <span className="bg-carbon-900 border-carbon-800 text-silver-400 shrink-0 rounded border px-1.5 py-0.5 text-[8px] uppercase">
                        {inst.exchange}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleResetDefaults}
              className="text-silver-400 hover:text-silver-200 mt-1 text-left font-mono text-[9px] tracking-wider uppercase underline underline-offset-2"
            >
              Reset to Defaults
            </button>
          </motion.div>
        )}

        <hr className="border-carbon-800/80" />

        {/* Recent Simulations */}
        <div className="flex flex-1 flex-col gap-2.5 overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-silver-400 font-mono text-[10px] font-bold tracking-wider uppercase">
              Recent Simulations
            </h3>
            <Link
              to="/backtests"
              className="text-brass-400 hover:text-brass-500 flex items-center gap-0.5 font-mono text-[9px] font-bold tracking-wider uppercase transition-colors duration-150"
            >
              History <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {historyQuery.isLoading ? (
              <div className="flex flex-1 items-center justify-center py-4">
                <span className="text-silver-500 font-mono text-[10px]">Loading history…</span>
              </div>
            ) : recentRuns.length > 0 ? (
              recentRuns.map((run) => {
                const isProfit = (run.summary?.total_pnl ?? 0) >= 0
                return (
                  <div
                    key={run.run_id}
                    className="bg-carbon-900/35 border-carbon-800/60 hover:border-brass-600/20 flex items-center justify-between rounded-xl border p-2.5 transition-colors duration-200"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-silver-100 truncate font-mono text-[11px] font-bold">
                        {run.symbol} · {run.strategy.replace(/Strategy$/, '')}
                      </span>
                      <span className="text-silver-500 font-mono text-[9px] tracking-wider uppercase">
                        {run.timeframe} · Win Rate:{' '}
                        {run.summary ? `${(run.summary.win_rate * 100).toFixed(0)}%` : '—'}
                      </span>
                    </div>

                    <div className="flex shrink-0 flex-col items-end">
                      <span
                        className={cn(
                          'font-mono text-[11px] font-bold tabular-nums',
                          isProfit ? 'text-emerald-400' : 'text-rose-400',
                        )}
                      >
                        {run.summary
                          ? `${isProfit ? '+' : ''}${run.summary.total_pnl.toLocaleString('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              maximumFractionDigits: 0,
                            })}`
                          : '—'}
                      </span>
                      <span className="text-silver-400 font-mono text-[9px]">
                        PF: {run.summary?.profit_factor?.toFixed(2) ?? '—'}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="border-carbon-800/40 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed py-4 text-center">
                <Clock className="text-silver-500 mb-1.5 h-4.5 w-4.5 opacity-40" />
                <span className="text-silver-400 font-mono text-[9px] tracking-wider uppercase">
                  No Simulations
                </span>
                <span className="text-silver-500 mt-0.5 text-[9px]">
                  Simulate a strategy to see history here.
                </span>
              </div>
            )}
          </div>
        </div>
      </FloatingLauncherPanel>

      {/* Right Sidebar - System Performance, Health, Active Jobs & News */}
      <FloatingLauncherPanel
        className="gap-4 p-4"
        containerRef={dashboardRef}
        layout={panelLayouts.system}
        panel="system"
        setLayout={updatePanelLayout}
      >
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="text-brass-400 h-4.5 w-4.5" />
            <h2 className="text-silver-100 text-xs font-semibold tracking-wider uppercase">
              System Gauge
            </h2>
            <span className="bg-carbon-900 text-silver-400 border-carbon-800/80 ml-auto rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-wider uppercase">
              {env.enableMsw ? 'MSW Mock' : 'Live Mode'}
            </span>
          </div>
          <p className="text-silver-400 mt-1 text-[11px]">Engine telemetry, status & news.</p>
        </div>

        {/* System Health Status */}
        <div className="bg-carbon-900/30 border-carbon-800/60 rounded-xl border p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-silver-300 font-mono text-xs font-semibold">Backend API</span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                    health?.status === 'healthy' ? 'bg-emerald-400' : 'bg-rose-400',
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    health?.status === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                />
              </span>
              <span className="text-silver-100 font-mono text-[10px] font-bold uppercase">
                {health?.status === 'healthy' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          <div className="text-silver-400 mt-2.5 flex flex-col gap-1 font-mono text-[10px]">
            <div className="flex justify-between">
              <span>Data Lake:</span>
              <span className="text-silver-200 capitalize">
                {health?.dataLakeStatus ?? 'Offline'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Engine Version:</span>
              <span className="text-silver-200">{health?.backendVersion ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Resource Telemetry */}
        <div className="flex flex-col gap-3">
          <h3 className="text-silver-400 font-mono text-[10px] font-bold tracking-wider uppercase">
            Performance Metrics
          </h3>
          <div className="flex flex-col gap-2.5">
            {/* CPU Gauge */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-silver-300 flex items-center gap-1">
                  <Database className="text-silver-400 h-3 w-3" /> CPU Core Load
                </span>
                <span className="text-brass-400 font-bold tabular-nums">{cpu}%</span>
              </div>
              <div className="bg-carbon-950/85 border-brass-600/10 h-1.5 w-full overflow-hidden rounded-full border shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                <div
                  className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out"
                  style={{ width: `${cpu}%` }}
                />
              </div>
            </div>

            {/* RAM Gauge */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-silver-300 flex items-center gap-1">
                  <HardDrive className="text-silver-400 h-3 w-3" /> Engine Memory
                </span>
                <span className="text-brass-400 font-bold tabular-nums">{ram.toFixed(1)}%</span>
              </div>
              <div className="bg-carbon-950/85 border-brass-600/10 h-1.5 w-full overflow-hidden rounded-full border shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                <div
                  className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out"
                  style={{ width: `${ram}%` }}
                />
              </div>
            </div>

            {/* Disk IO */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-silver-300 flex items-center gap-1">
                  <RefreshCw className="text-silver-400 animate-spin-slow h-3 w-3" /> Database Disk
                  I/O
                </span>
                <span className="text-brass-400 font-bold tabular-nums">{io.toFixed(1)} MB/s</span>
              </div>
              <div className="bg-carbon-950/85 border-brass-600/10 h-1.5 w-full overflow-hidden rounded-full border shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                <div
                  className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, (io / 45) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-carbon-800/80" />

        {/* Active Background Jobs (Conditional) */}
        {runningJobsCount > 0 && (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-silver-400 font-mono text-[10px] font-bold tracking-wider uppercase">
                  Active Workloads
                </h3>
                <span className="bg-brass-500/10 text-brass-400 animate-pulse rounded px-1.5 py-0.5 font-mono text-[9px] font-bold">
                  {runningJobsCount} Running
                </span>
              </div>
              <div className="flex max-h-[120px] flex-col gap-2 overflow-y-auto pr-1">
                {Object.entries(activeJobs).map(([workspaceId, job]) => {
                  if (!job) return null
                  return (
                    <div
                      key={workspaceId}
                      className="bg-carbon-900/35 border-carbon-850 hover:border-brass-600/20 flex flex-col gap-1.5 rounded-xl border p-2.5 transition-colors duration-200"
                    >
                      <div className="flex items-center justify-between font-mono text-[9px] font-bold">
                        <span className="text-silver-200 tracking-wider uppercase">
                          {workspaceId}
                        </span>
                        <span className="text-brass-400 tabular-nums">{job.pct}%</span>
                      </div>
                      <div className="bg-carbon-950/85 border-brass-600/10 h-1 w-full overflow-hidden rounded-full border">
                        <div
                          className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r"
                          style={{ width: `${job.pct}%` }}
                        />
                      </div>
                      <span className="text-silver-400 truncate text-[9px]">{job.detail}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <hr className="border-carbon-800/80" />
          </>
        )}

        {/* Market News Feed */}
        <div className="flex flex-1 flex-col gap-2.5 overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-silver-400 font-mono text-[10px] font-bold tracking-wider uppercase">
              Market News Feed
            </h3>
            <Newspaper className="text-brass-400 h-3.5 w-3.5" />
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {mockArticles.map((article) => (
              <button
                key={article.id}
                onClick={() => handleOpenArticle(article.id)}
                className="bg-carbon-900/35 border-carbon-800/60 hover:border-brass-600/20 group flex cursor-pointer flex-col gap-1 rounded-xl border p-2.5 text-left transition-colors duration-200"
              >
                <div className="text-silver-500 flex w-full items-center justify-between font-mono text-[9px]">
                  <span>{article.source}</span>
                  <span>{article.publishedAt}</span>
                </div>
                <span className="text-silver-100 group-hover:text-brass-400 mt-0.5 line-clamp-1 font-sans text-[11px] leading-snug font-semibold transition-colors">
                  {article.title}
                </span>
                <span className="text-silver-400 mt-0.5 line-clamp-2 text-[9px] leading-normal">
                  {article.summary}
                </span>
              </button>
            ))}
          </div>
        </div>
      </FloatingLauncherPanel>
    </div>
  )
}
