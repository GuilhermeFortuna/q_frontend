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
import { useNewsList } from '@/api/queries/news'
import { formatDistanceToNow } from 'date-fns'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'
import type { LauncherPanelLayout, LauncherPanelLayouts } from '@/store/slices/jobSessionsSlice'
import { useAppStore } from '@/store/useAppStore'
import {
  clampPanelLayout,
  getDefaultPanelLayouts,
  getLauncherPanelBounds,
  layoutsAreEqual,
  normalizePanelLayout,
  panelLayoutNeedsRecovery,
  PANEL_MIN_WIDTH,
  type ContainerRect,
} from '@/components/launcher/launcherPanelLayout'

type PanelKey = 'market' | 'system'

type ResizeMode = 'resize-se' | 'resize-e' | 'resize-s' | 'resize-w'

const DEFAULT_SYMBOLS = ['BTCUSD', 'EURUSD', 'PETR4', 'VALE3']
const LOCAL_STORAGE_KEY = 'quant-dashboard-symbols'
const LEGACY_PANEL_LAYOUT_STORAGE_KEY = 'quant-launcher-panel-layouts'

function readLegacyPanelLayouts(): Partial<LauncherPanelLayouts> {
  try {
    const stored = localStorage.getItem(LEGACY_PANEL_LAYOUT_STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored) as Partial<LauncherPanelLayouts>
    localStorage.removeItem(LEGACY_PANEL_LAYOUT_STORAGE_KEY)
    return parsed
  } catch {
    return {}
  }
}

function readContainerRect(node: HTMLDivElement | null): ContainerRect | null {
  if (!node) return null
  const bounds = node.getBoundingClientRect()
  const width = bounds.width || node.clientWidth
  const height = bounds.height || node.clientHeight
  if (width <= 0 || height <= 0) return null
  return { width, height }
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
  interactionRef: RefObject<boolean>
  layout: LauncherPanelLayout
  panel: PanelKey
  setLayout: (panel: PanelKey, layout: LauncherPanelLayout) => void
}

function FloatingLauncherPanel({
  children,
  className,
  containerRef,
  interactionRef,
  layout,
  panel,
  setLayout,
}: FloatingLauncherPanelProps) {
  const dragStartRef = useRef<{
    layout: LauncherPanelLayout
    pointerX: number
    pointerY: number
    mode: 'drag' | ResizeMode
  } | null>(null)

  const updateFromPointer = (clientX: number, clientY: number) => {
    const start = dragStartRef.current
    if (!start) return

    const deltaX = clientX - start.pointerX
    const deltaY = clientY - start.pointerY
    const containerRect = readContainerRect(containerRef.current)
    const layoutBounds = containerRect ? getLauncherPanelBounds(containerRect) : null

    let next: LauncherPanelLayout
    switch (start.mode) {
      case 'drag':
        next = {
          ...start.layout,
          x: start.layout.x + deltaX,
          y: start.layout.y + deltaY,
        }
        break
      case 'resize-e':
        next = {
          ...start.layout,
          width: start.layout.width + deltaX,
        }
        break
      case 'resize-w': {
        const maxDeltaX = start.layout.width - PANEL_MIN_WIDTH
        const clampedDeltaX = Math.min(deltaX, maxDeltaX)
        next = {
          ...start.layout,
          x: start.layout.x + clampedDeltaX,
          width: start.layout.width - clampedDeltaX,
        }
        break
      }
      case 'resize-s':
        next = {
          ...start.layout,
          height: start.layout.height + deltaY,
        }
        break
      case 'resize-se':
        next = {
          ...start.layout,
          width: start.layout.width + deltaX,
          height: start.layout.height + deltaY,
        }
        break
      default: {
        const unhandledMode: never = start.mode
        throw new Error(`Unhandled panel interaction mode: ${unhandledMode}`)
      }
    }

    setLayout(panel, clampPanelLayout(next, layoutBounds))
  }

  const startInteraction =
    (mode: 'drag' | ResizeMode) => (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      interactionRef.current = true
      const containerRect = readContainerRect(containerRef.current)
      const layoutBounds = containerRect ? getLauncherPanelBounds(containerRect) : null
      const defaults = layoutBounds
        ? getDefaultPanelLayouts(layoutBounds.width, layoutBounds.height)[panel]
        : layout
      const safeLayout = layoutBounds
        ? normalizePanelLayout(layout, layoutBounds, defaults)
        : layout
      dragStartRef.current = {
        layout: safeLayout,
        pointerX: event.clientX,
        pointerY: event.clientY,
        mode,
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateFromPointer(moveEvent.clientX, moveEvent.clientY)
      }

      const handleMouseUp = () => {
        interactionRef.current = false
        dragStartRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

  return (
    <div
      className={cn(
        'surface-panel quant-panel--spotlight bg-espresso-950/80 absolute z-30 flex min-h-0 flex-col overflow-hidden rounded-2xl',
      )}
      style={{
        position: 'absolute',
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
      }}
    >
      <div
        role="presentation"
        onMouseDown={startInteraction('drag')}
        className="border-brass-600/15 bg-carbon-950/50 absolute inset-x-0 top-0 z-20 flex h-9 cursor-grab touch-none items-center justify-center border-b active:cursor-grabbing"
      >
        <GripHorizontal className="text-silver-400 h-4 w-4" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-9">
        <div className="flex min-h-0 flex-1">
          <div
            role="presentation"
            aria-label={`Resize ${panel} panel width from left`}
            title="Resize width"
            onMouseDown={startInteraction('resize-w')}
            className="hover:bg-brass-500/10 w-4 shrink-0 cursor-ew-resize touch-none transition-colors"
          />
          <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>{children}</div>
          <div
            role="presentation"
            aria-label={`Resize ${panel} panel width`}
            title="Resize width"
            onMouseDown={startInteraction('resize-e')}
            className="hover:bg-brass-500/10 w-4 shrink-0 cursor-ew-resize touch-none transition-colors"
          />
        </div>
        <div
          role="presentation"
          aria-label={`Resize ${panel} panel height`}
          title="Resize height"
          onMouseDown={startInteraction('resize-s')}
          className="border-brass-600/15 hover:bg-brass-500/10 h-4 shrink-0 cursor-ns-resize touch-none border-t transition-colors"
        />
      </div>

      <div
        role="presentation"
        aria-label={`Resize ${panel} panel`}
        title="Resize panel"
        onMouseDown={startInteraction('resize-se')}
        className="border-brass-500/40 absolute right-0 bottom-0 z-30 h-5 w-5 cursor-nwse-resize touch-none rounded-br-2xl border-r-2 border-b-2"
      />
    </div>
  )
}

export function LauncherDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const isInteractingRef = useRef(false)
  const lastContainerSizeRef = useRef({ width: 0, height: 0 })
  const storedPanelLayouts = useAppStore((s) => s.launcherSession.panelLayouts)
  const patchLauncherSession = useAppStore((s) => s.patchLauncherSession)
  const panelLayouts = storedPanelLayouts ?? getDefaultPanelLayouts()

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
  const {
    data: articles = [],
    isPending: isNewsPending,
    refetch: refetchNews,
    isRefetching: isNewsRefetching,
  } = useNewsList()

  // For adding new symbols
  const instrumentsQuery = useInstruments()
  const allInstruments = useMemo(() => instrumentsQuery.data ?? [], [instrumentsQuery.data])

  const [searchQuery, setSearchQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const searchResultsQuery = useSearchSymbols(searchQuery)
  const searchResults = useMemo(() => searchResultsQuery.data ?? [], [searchResultsQuery.data])

  const updatePanelLayout = (panel: PanelKey, layout: LauncherPanelLayout) => {
    const current = useAppStore.getState().launcherSession.panelLayouts ?? getDefaultPanelLayouts()
    patchLauncherSession({
      panelLayouts: { ...current, [panel]: layout },
    })
  }

  useEffect(() => {
    const node = dashboardRef.current
    if (!node) return

    const syncLayoutsToContainer = () => {
      if (isInteractingRef.current) return

      const containerRect = readContainerRect(node)
      if (!containerRect) return

      const layoutBounds = getLauncherPanelBounds(containerRect)

      const current = useAppStore.getState().launcherSession.panelLayouts
      const defaults = getDefaultPanelLayouts(layoutBounds.width, layoutBounds.height)
      const legacyLayouts = current ? {} : readLegacyPanelLayouts()
      const source = current ?? {
        market: { ...defaults.market, ...legacyLayouts.market },
        system: { ...defaults.system, ...legacyLayouts.system },
      }
      const next = {
        market: normalizePanelLayout(source.market, layoutBounds, defaults.market),
        system: normalizePanelLayout(source.system, layoutBounds, defaults.system),
      }

      const sizeUnchanged =
        containerRect.width === lastContainerSizeRef.current.width &&
        containerRect.height === lastContainerSizeRef.current.height
      const needsRecovery =
        current != null &&
        (panelLayoutNeedsRecovery(source.market, layoutBounds, defaults.market) ||
          panelLayoutNeedsRecovery(source.system, layoutBounds, defaults.system))

      if (sizeUnchanged && current && !needsRecovery && layoutsAreEqual(current, next)) {
        return
      }

      lastContainerSizeRef.current = containerRect

      if (current && layoutsAreEqual(current, next)) return

      patchLauncherSession({ panelLayouts: next })
    }

    syncLayoutsToContainer()
    const observer = new ResizeObserver(syncLayoutsToContainer)
    observer.observe(node)
    return () => observer.disconnect()
  }, [patchLauncherSession])

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
    <div ref={dashboardRef} className="relative min-h-0 w-full flex-1">
      {/* Left Sidebar - Market Tickers & Recent Simulations */}
      <FloatingLauncherPanel
        className="gap-4 p-4"
        containerRef={dashboardRef}
        interactionRef={isInteractingRef}
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
        <div className="flex flex-col gap-3">
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
                <div className="surface-overlay border-carbon-800 absolute right-0 left-0 z-50 mt-1 flex max-h-[160px] scrollbar-thin flex-col gap-0.5 overflow-y-auto rounded-lg border p-1">
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
        <div className="flex flex-col gap-2.5">
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

          <div className="flex flex-col gap-2">
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
        interactionRef={isInteractingRef}
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
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-silver-400 font-mono text-[10px] font-bold tracking-wider uppercase">
              Market News Feed
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void refetchNews()}
                disabled={isNewsPending || isNewsRefetching}
                className="text-silver-500 hover:text-brass-400 cursor-pointer rounded p-0.5 transition-colors disabled:opacity-50"
                title="Refresh news feed"
              >
                <RefreshCw className={cn('h-3 w-3', isNewsRefetching && 'animate-spin')} />
              </button>
              <Newspaper className="text-brass-400 h-3.5 w-3.5" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {isNewsPending ? (
              <div className="border-carbon-800/40 flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center">
                <RefreshCw className="text-brass-400 h-4 w-4 animate-spin opacity-60" />
                <span className="text-silver-500 mt-2 font-mono text-[9px] tracking-wider uppercase">
                  Loading Feed...
                </span>
              </div>
            ) : articles.length === 0 ? (
              <div className="border-carbon-800/40 flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center">
                <Newspaper className="text-silver-600 mb-1 h-4 w-4 opacity-40" />
                <span className="text-silver-500 font-mono text-[9px] tracking-wider uppercase">
                  No articles available
                </span>
              </div>
            ) : (
              articles.map((article) => {
                const formatPublishedAt = (dateStr: string) => {
                  try {
                    const date = new Date(dateStr)
                    if (isNaN(date.getTime())) return dateStr
                    return formatDistanceToNow(date, { addSuffix: true })
                  } catch {
                    return dateStr
                  }
                }

                return (
                  <button
                    key={article.id}
                    onClick={() => handleOpenArticle(article.id)}
                    className="bg-carbon-900/35 border-carbon-800/60 hover:border-brass-600/20 group flex cursor-pointer flex-col gap-1 rounded-xl border p-2.5 text-left transition-colors duration-200"
                  >
                    <div className="text-silver-500 flex w-full items-center justify-between font-mono text-[9px]">
                      <span>{article.source}</span>
                      <span>{formatPublishedAt(article.publishedAt)}</span>
                    </div>
                    <span className="text-silver-100 group-hover:text-brass-400 mt-0.5 line-clamp-1 font-sans text-[11px] leading-snug font-semibold transition-colors">
                      {article.title}
                    </span>
                    <span className="text-silver-400 mt-0.5 line-clamp-2 text-[9px] leading-normal">
                      {article.summary}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </FloatingLauncherPanel>
    </div>
  )
}
