import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Search } from 'lucide-react'

import { useSearchSymbols } from '@/api/queries/market-data'
import { parseTimeframeInput } from '@/lib/market/timeframeCommands'
import type { Instrument } from '@/types/api'

export type SymbolCommandPaletteProps = {
  onSelectSymbol: (instrument: Instrument) => void
  onAddToWatchlist: (instrument: Instrument) => void
  onSelectTimeframe: (timeframe: string) => void
  onQueryChange?: (query: string) => void
}

export function SymbolCommandPalette({
  onSelectSymbol,
  onAddToWatchlist,
  onSelectTimeframe,
  onQueryChange,
}: SymbolCommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const searchResultsQuery = useSearchSymbols(query)
  const searchResults = searchResultsQuery.data || []

  const parsedTimeframe = useMemo(() => parseTimeframeInput(query), [query])

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

    searchResults.forEach((inst) => {
      items.push({
        type: 'symbol',
        symbol: inst,
      })
    })

    return items
  }, [parsedTimeframe, searchResults])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const isAlphanumericOrSpace = /^[a-zA-Z0-9$@\s]$/.test(e.key)
      if (isAlphanumericOrSpace && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const nextQuery = e.key === ' ' ? '' : e.key
        setOpen(true)
        setQuery(nextQuery)
        onQueryChange?.(nextQuery)
        setSelectedIndex(0)
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus()
      const val = searchInputRef.current.value
      searchInputRef.current.value = ''
      searchInputRef.current.value = val
    }
  }, [open])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (open && overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        onQueryChange?.('')
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const selectSearchResult = (inst: Instrument) => {
    onAddToWatchlist(inst)
    onSelectSymbol(inst)
    setOpen(false)
    setQuery('')
    onQueryChange?.('')
  }

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      onQueryChange?.('')
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      setSelectedIndex((prev) => Math.min(prev + 1, dropdownItems.length - 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
      e.preventDefault()
    } else if (e.key === 'Enter') {
      const selectedItem = dropdownItems[selectedIndex]
      if (selectedItem) {
        if (selectedItem.type === 'timeframe') {
          onSelectTimeframe(selectedItem.value)
          setOpen(false)
          setQuery('')
          onQueryChange?.('')
        } else {
          selectSearchResult(selectedItem.symbol)
        }
      }
      e.preventDefault()
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="bg-carbon-950/60 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div
        ref={overlayRef}
        className="quant-panel bg-carbon-900 border-brass-500/30 flex max-h-[400px] w-[480px] flex-col overflow-hidden rounded-xl border shadow-2xl"
      >
        <div className="border-carbon-700/60 bg-carbon-800/80 flex items-center gap-3 border-b p-4">
          <Search className="text-brass-400 h-4 w-4" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search symbol..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              onQueryChange?.(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleSearchInputKeyDown}
            className="text-silver-100 placeholder-silver-400 flex-1 bg-transparent font-mono text-base outline-none"
          />
          <span className="border-carbon-600 bg-carbon-900 text-silver-400 rounded border px-1.5 py-0.5 font-mono text-[10px]">
            ESC to exit
          </span>
        </div>

        <div className="min-h-[150px] flex-1 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="text-silver-400 flex h-32 items-center justify-center font-mono text-xs">
              Start typing to search symbols or switch timeframes…
            </div>
          ) : searchResultsQuery.isLoading && dropdownItems.length === 0 ? (
            <div className="text-silver-400 flex h-32 flex-col items-center justify-center gap-2 font-mono text-xs">
              <Activity className="text-brass-500 h-6 w-6 animate-pulse" />
              <span>Searching MetaTrader terminal…</span>
            </div>
          ) : dropdownItems.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {dropdownItems.map((item, index) => {
                const isActive = index === selectedIndex
                if (item.type === 'timeframe') {
                  return (
                    <div
                      key={`tf-${item.value}`}
                      onClick={() => {
                        onSelectTimeframe(item.value)
                        setOpen(false)
                        setQuery('')
                        onQueryChange?.('')
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
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
                }

                const inst = item.symbol
                return (
                  <div
                    key={`sym-${inst.symbol}`}
                    onClick={() => selectSearchResult(inst)}
                    onMouseEnter={() => setSelectedIndex(index)}
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
  )
}
