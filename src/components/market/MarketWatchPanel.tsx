import { ChevronDown, ChevronUp, Minus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { FlashOnChange } from '@/components/shared/FlashOnChange'
import { useSparklines } from '@/hooks/useSparklines'
import { useDebounce } from '@/hooks/useDebounce'
import { useSearchSymbols } from '@/api/queries/market-data'
import { formatPrice } from '@/lib/market/format'
import { closesToPath, sparklineStrokeColor } from '@/lib/market/sparkline'
import type { Instrument, MarketSnapshot } from '@/types/api'

import { ChangeBadge } from './ChangeBadge'
import { SkeletonBar } from './SkeletonBar'

export type MarketWatchPanelProps = {
  watchlist: Instrument[]
  snapshotsBySymbol: Record<string, MarketSnapshot>
  selectedSymbol: string
  isLoadingInstruments: boolean
  onSelectSymbol: (symbol: string) => void
  onAddInstrument: (instrument: Instrument) => void
  onRemoveInstrument: (symbol: string) => void
}

type SortColumn = 'symbol' | 'last' | 'changePct'
type SortDirection = 'asc' | 'desc'

const ASSET_CLASS_LABELS: Record<Instrument['assetClass'], string> = {
  equity: 'Stocks',
  etf: 'ETFs',
  fx: 'Forex',
  crypto: 'Crypto',
  future: 'Futures',
}

const SPARKLINE_WIDTH = 56
const SPARKLINE_HEIGHT = 16

function SortCaret({ active, direction }: { active: boolean; direction: SortDirection | null }) {
  if (!active || !direction) {
    return null
  }

  return direction === 'asc' ? (
    <ChevronUp className="text-brass-400 inline h-3 w-3" aria-hidden="true" />
  ) : (
    <ChevronDown className="text-brass-400 inline h-3 w-3" aria-hidden="true" />
  )
}

function Sparkline({ closes }: { closes: number[] | undefined }) {
  if (!closes || closes.length === 0) {
    return (
      <span className="text-silver-500 inline-block w-14 text-center font-mono text-[10px]">—</span>
    )
  }

  const path = closesToPath(closes, SPARKLINE_WIDTH, SPARKLINE_HEIGHT)
  const stroke = sparklineStrokeColor(closes)

  return (
    <svg
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function WatchlistSkeletonRows() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="border-carbon-800/40 grid min-h-[28px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_56px] items-center gap-2 border-b px-2.5 py-1.5"
        >
          <SkeletonBar className="h-3.5 w-12" />
          <SkeletonBar className="h-3.5 w-14 justify-self-end" />
          <SkeletonBar className="h-3 w-10 justify-self-end" />
          <SkeletonBar className="h-4 w-14 justify-self-end" />
        </div>
      ))}
    </div>
  )
}

export function MarketWatchPanel({
  watchlist,
  snapshotsBySymbol,
  selectedSymbol,
  isLoadingInstruments,
  onSelectSymbol,
  onAddInstrument,
  onRemoveInstrument,
}: MarketWatchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 200)
  const chartSearchResultsQuery = useSearchSymbols(debouncedSearchQuery)
  const mt5SearchResults = chartSearchResultsQuery.data || []
  const mt5SearchLoading = chartSearchResultsQuery.isLoading
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [listFocused, setListFocused] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const watchlistSymbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist])
  const closesBySymbol = useSparklines(watchlistSymbols)

  const filteredInstruments = useMemo(() => {
    return watchlist.filter(
      (inst) =>
        inst.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [watchlist, searchQuery])

  const sortedInstruments = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return filteredInstruments
    }

    const next = [...filteredInstruments]
    next.sort((left, right) => {
      if (sortColumn === 'symbol') {
        const comparison = left.symbol.localeCompare(right.symbol)
        return sortDirection === 'asc' ? comparison : -comparison
      }

      const leftSnap = snapshotsBySymbol[left.symbol]
      const rightSnap = snapshotsBySymbol[right.symbol]

      if (sortColumn === 'last') {
        const leftValue = leftSnap?.last ?? Number.NEGATIVE_INFINITY
        const rightValue = rightSnap?.last ?? Number.NEGATIVE_INFINITY
        return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue
      }

      const leftValue = leftSnap?.changePct ?? Number.NEGATIVE_INFINITY
      const rightValue = rightSnap?.changePct ?? Number.NEGATIVE_INFINITY
      return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue
    })

    return next
  }, [filteredInstruments, snapshotsBySymbol, sortColumn, sortDirection])

  const distinctAssetClasses = useMemo(
    () => new Set(sortedInstruments.map((item) => item.assetClass)),
    [sortedInstruments],
  )
  const shouldGroup = distinctAssetClasses.size > 1

  const groupedInstruments = useMemo(() => {
    if (!shouldGroup) {
      return [{ assetClass: null as Instrument['assetClass'] | null, items: sortedInstruments }]
    }

    const groups = new Map<Instrument['assetClass'], Instrument[]>()
    for (const instrument of sortedInstruments) {
      const current = groups.get(instrument.assetClass) ?? []
      current.push(instrument)
      groups.set(instrument.assetClass, current)
    }

    return Array.from(groups.entries()).map(([assetClass, items]) => ({ assetClass, items }))
  }, [shouldGroup, sortedInstruments])

  const flatRows = useMemo(
    () => groupedInstruments.flatMap((group) => group.items),
    [groupedInstruments],
  )

  const flatRowsWithIndex = useMemo(
    () => flatRows.map((instrument, index) => ({ instrument, index })),
    [flatRows],
  )

  const rowIndexBySymbol = useMemo(
    () => new Map(flatRowsWithIndex.map(({ instrument, index }) => [instrument.symbol, index])),
    [flatRowsWithIndex],
  )

  const handleSortClick = (column: SortColumn) => {
    if (sortColumn !== column) {
      setSortColumn(column)
      setSortDirection('asc')
      return
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc')
      return
    }

    if (sortDirection === 'desc') {
      setSortColumn(null)
      setSortDirection(null)
      return
    }

    setSortDirection('asc')
  }

  const toggleGroup = (assetClass: Instrument['assetClass']) => {
    setCollapsedGroups((current) => ({
      ...current,
      [assetClass]: !current[assetClass],
    }))
  }

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (flatRowsWithIndex.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setListFocused(true)
      setFocusedIndex((current) => Math.min(current + 1, flatRowsWithIndex.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setListFocused(true)
      setFocusedIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      const target = flatRowsWithIndex[focusedIndex]?.instrument
      if (target) {
        event.preventDefault()
        onSelectSymbol(target.symbol)
      }
      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const target = flatRowsWithIndex[focusedIndex]?.instrument
      if (target) {
        event.preventDefault()
        onRemoveInstrument(target.symbol)
        setFocusedIndex((current) => Math.min(current, flatRowsWithIndex.length - 2))
      }
    }
  }

  useEffect(() => {
    if (focusedIndex >= flatRowsWithIndex.length) {
      setFocusedIndex(Math.max(flatRowsWithIndex.length - 1, -1))
    }
  }, [flatRowsWithIndex.length, focusedIndex])

  useEffect(() => {
    const selectedIndex = flatRowsWithIndex.findIndex(
      ({ instrument }) => instrument.symbol === selectedSymbol,
    )
    if (selectedIndex >= 0 && listFocused) {
      setFocusedIndex(selectedIndex)
    }
  }, [flatRowsWithIndex, selectedSymbol, listFocused])

  const renderRow = (inst: Instrument, rowIndex: number) => {
    const isSelected = inst.symbol === selectedSymbol
    const isFocused = listFocused && rowIndex === focusedIndex
    const rowSnap = snapshotsBySymbol[inst.symbol]
    const rowDigits = rowSnap?.digits ?? 2

    return (
      <div
        key={inst.symbol}
        role="option"
        aria-selected={isSelected}
        tabIndex={isFocused ? 0 : -1}
        onClick={() => {
          setListFocused(true)
          setFocusedIndex(rowIndex)
          onSelectSymbol(inst.symbol)
        }}
        onFocus={() => {
          setListFocused(true)
          setFocusedIndex(rowIndex)
        }}
        className={`group border-carbon-800/40 relative grid min-h-[28px] cursor-pointer grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_56px] items-center gap-2 border-b px-2.5 py-1.5 transition-all select-none ${
          isSelected
            ? 'bg-brass-600/10 text-silver-100'
            : isFocused
              ? 'ring-brass-400 bg-carbon-800/30 text-silver-200 ring-1 ring-inset'
              : 'hover:bg-carbon-800/40 text-silver-300'
        }`}
      >
        <span
          className={`truncate font-mono text-xs font-bold ${
            isSelected ? 'text-brass-400' : 'text-silver-200'
          }`}
        >
          {inst.symbol}
        </span>

        <div className="text-right">
          {rowSnap ? (
            <FlashOnChange
              value={rowSnap.last}
              className="quant-tabular-nums text-silver-200 block font-mono text-xs font-semibold"
            >
              {formatPrice(rowSnap.last, rowDigits)}
            </FlashOnChange>
          ) : (
            <span className="quant-tabular-nums text-silver-400 block font-mono text-xs font-semibold">
              —
            </span>
          )}
        </div>

        <div className="text-right">
          {rowSnap ? (
            <ChangeBadge changePct={rowSnap.changePct} className="text-[10px]" />
          ) : (
            <span className="text-silver-500 font-mono text-[10px]">—</span>
          )}
        </div>

        <div className="flex justify-end">
          <Sparkline closes={closesBySymbol[inst.symbol]} />
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemoveInstrument(inst.symbol)
          }}
          className="bg-carbon-700/80 text-silver-400 absolute top-1/2 right-1 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded transition-all group-hover:flex hover:text-rose-400 active:scale-90"
          title="Remove from watchlist"
        >
          <Minus className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="surface-panel flex h-full flex-col overflow-hidden rounded-lg">
      <div className="border-carbon-700 border-b p-2.5">
        <p className="text-silver-300 mb-2 text-xs font-semibold tracking-wider uppercase">
          Market Watch
        </p>
        <div className="relative">
          <Search className="text-silver-400 absolute top-2 left-2.5 h-3.5 w-3.5" />
          <input
            type="text"
            placeholder="Filter symbols..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="border-carbon-700 bg-carbon-900 text-silver-100 placeholder-silver-400 focus:border-brass-500 focus:ring-brass-500/20 w-full rounded border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
          />
        </div>
      </div>

      <div className="text-silver-500 border-carbon-800/60 grid shrink-0 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_56px] gap-2 border-b px-2.5 py-1 font-mono text-[9px] tracking-wider uppercase">
        <button
          type="button"
          onClick={() => handleSortClick('symbol')}
          className="hover:text-brass-400 flex items-center gap-0.5 text-left transition-colors"
        >
          Symbol
          <SortCaret active={sortColumn === 'symbol'} direction={sortDirection} />
        </button>
        <button
          type="button"
          onClick={() => handleSortClick('last')}
          className="hover:text-brass-400 flex items-center justify-end gap-0.5 transition-colors"
        >
          Last
          <SortCaret active={sortColumn === 'last'} direction={sortDirection} />
        </button>
        <button
          type="button"
          onClick={() => handleSortClick('changePct')}
          className="hover:text-brass-400 flex items-center justify-end gap-0.5 transition-colors"
        >
          Chg%
          <SortCaret active={sortColumn === 'changePct'} direction={sortDirection} />
        </button>
        <span className="text-right">Spark</span>
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Market watchlist"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        onFocus={() => {
          setListFocused(true)
          if (focusedIndex < 0 && flatRowsWithIndex.length > 0) {
            const selectedIndex = flatRowsWithIndex.findIndex(
              ({ instrument }) => instrument.symbol === selectedSymbol,
            )
            setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0)
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setListFocused(false)
          }
        }}
        className="focus-visible:ring-brass-500/40 min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-1"
      >
        {isLoadingInstruments && watchlist.length === 0 ? (
          <WatchlistSkeletonRows />
        ) : (
          <div className="flex flex-col">
            {flatRows.length > 0 ? (
              groupedInstruments.map((group) => {
                const section = (
                  <>
                    {group.items.map((inst) =>
                      renderRow(inst, rowIndexBySymbol.get(inst.symbol) ?? 0),
                    )}
                  </>
                )

                if (!group.assetClass) {
                  return <div key="flat">{section}</div>
                }

                const collapsed = collapsedGroups[group.assetClass] ?? false

                return (
                  <div key={group.assetClass}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.assetClass!)}
                      className="bg-carbon-900/80 text-brass-400 hover:bg-carbon-800/60 flex w-full items-center justify-between px-2.5 py-1 font-mono text-[9px] tracking-wider uppercase"
                    >
                      <span>{ASSET_CLASS_LABELS[group.assetClass]}</span>
                      <span className="text-silver-500">{collapsed ? '+' : '−'}</span>
                    </button>
                    {!collapsed ? section : null}
                  </div>
                )
              })
            ) : searchQuery.trim() === '' ? (
              <div className="text-silver-400 flex h-24 items-center justify-center text-xs">
                No assets in watchlist.
              </div>
            ) : (
              <div className="text-silver-500 flex h-16 items-center justify-center text-xs italic">
                No local matches.
              </div>
            )}

            {searchQuery.trim().length > 1 && (
              <div className="border-carbon-700/60 mt-2 border-t pt-2">
                <p className="text-brass-400 mb-1.5 px-2.5 text-[10px] font-bold tracking-wider uppercase">
                  Add Symbol
                </p>
                {mt5SearchLoading ? (
                  <div className="flex flex-col gap-2 px-2.5 py-2">
                    <SkeletonBar className="h-8 w-full" />
                    <SkeletonBar className="h-8 w-full" />
                  </div>
                ) : mt5SearchResults.length > 0 ? (
                  mt5SearchResults
                    .filter(
                      (item) => !watchlist.some((watchItem) => watchItem.symbol === item.symbol),
                    )
                    .map((inst) => (
                      <div
                        key={inst.symbol}
                        onClick={() => {
                          onAddInstrument(inst)
                          setSearchQuery('')
                        }}
                        className="border-carbon-800/40 hover:bg-carbon-800/40 text-silver-300 flex min-h-[28px] cursor-pointer items-center justify-between border-b px-2.5 py-1.5 transition-all"
                      >
                        <span className="text-silver-200 truncate font-mono text-xs font-bold">
                          {inst.symbol}
                        </span>
                        <span className="bg-carbon-800 border-carbon-700/60 text-brass-400 hover:text-brass-300 shrink-0 rounded border px-2 py-0.5 font-mono text-[9px] uppercase">
                          + Add
                        </span>
                      </div>
                    ))
                ) : (
                  <div className="text-silver-500 px-2.5 py-2 font-mono text-xs">
                    No matches found.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
