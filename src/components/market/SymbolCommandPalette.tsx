import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Search } from 'lucide-react'

import { useSearchSymbols } from '@/api/queries/market-data'
import { useDebounce } from '@/hooks/useDebounce'
import {
  commandActionLabel,
  commandSearchQuery,
  parseCommand,
  type ParsedCommand,
} from '@/lib/market/commands'
import { parseTimeframeInput } from '@/lib/market/timeframeCommands'
import type { Instrument } from '@/types/api'

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <>{text}</>
  const cleanQuery = query.trim()
  const parts = text.split(
    new RegExp(`(${cleanQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'),
  )
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === cleanQuery.toLowerCase() ? (
          <span key={i} className="text-brass-400 font-extrabold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

export type SymbolCommandPaletteProps = {
  onSelectSymbol: (instrument: Instrument) => void
  onAddToWatchlist: (instrument: Instrument) => void
  onRemoveFromWatchlist: (symbol: string) => void
  onSelectTimeframe: (timeframe: string) => void
  recentInstruments: Instrument[]
}

type DropdownItem =
  | { type: 'command'; parsed: ParsedCommand; label: string }
  | { type: 'timeframe'; label: string; value: string }
  | { type: 'recent'; symbol: Instrument }
  | { type: 'symbol'; symbol: Instrument }

export function SymbolCommandPalette({
  onSelectSymbol,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onSelectTimeframe,
  recentInstruments,
}: SymbolCommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const parsedCommand = useMemo(() => parseCommand(query), [query])
  const liveEffectiveSearchQuery = useMemo(
    () => commandSearchQuery(query, parsedCommand),
    [parsedCommand, query],
  )
  const debouncedSearchQuery = useDebounce(liveEffectiveSearchQuery, 200)
  const parsedTimeframe = useMemo(() => {
    if (parsedCommand?.kind === 'symbol-timeframe') {
      return null
    }
    return parseTimeframeInput(query)
  }, [parsedCommand, query])

  const searchResultsQuery = useSearchSymbols(debouncedSearchQuery)
  const searchResults = useMemo(() => searchResultsQuery.data ?? [], [searchResultsQuery.data])

  const dropdownItems = useMemo(() => {
    const items: DropdownItem[] = []

    if (parsedCommand) {
      items.push({
        type: 'command',
        parsed: parsedCommand,
        label: commandActionLabel(parsedCommand),
      })
    }

    if (parsedTimeframe) {
      items.push({
        type: 'timeframe',
        label: parsedTimeframe.label,
        value: parsedTimeframe.value,
      })
    }

    if (query.trim() === '') {
      recentInstruments.forEach((inst) => {
        items.push({ type: 'recent', symbol: inst })
      })
      return items
    }

    searchResults.forEach((inst) => {
      items.push({
        type: 'symbol',
        symbol: inst,
      })
    })

    return items
  }, [parsedCommand, parsedTimeframe, query, recentInstruments, searchResults])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const isAlphanumericOrSpace = /^[a-zA-Z0-9$@\s+-]$/.test(e.key)
      if (isAlphanumericOrSpace && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const nextQuery = e.key === ' ' ? '' : e.key
        setOpen(true)
        setQuery(nextQuery)
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
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const closePalette = () => {
    setOpen(false)
    setQuery('')
  }

  const resolveInstrument = (): Instrument | undefined => {
    if (searchResults.length > 0) {
      return searchResults[0]
    }

    if (parsedCommand && parsedCommand.kind !== 'symbol-timeframe') {
      const match = recentInstruments.find(
        (item) => item.symbol.toLowerCase() === parsedCommand.symbolQuery.toLowerCase(),
      )
      if (match) {
        return match
      }
    }

    return undefined
  }

  const executeCommand = (parsed: ParsedCommand) => {
    switch (parsed.kind) {
      case 'add-to-watchlist': {
        const instrument = resolveInstrument()
        if (instrument) {
          onAddToWatchlist(instrument)
        }
        closePalette()
        break
      }
      case 'remove-from-watchlist': {
        const instrument = resolveInstrument()
        onRemoveFromWatchlist(instrument?.symbol ?? parsed.symbolQuery)
        closePalette()
        break
      }
      case 'symbol-timeframe': {
        const instrument = resolveInstrument()
        if (instrument) {
          onAddToWatchlist(instrument)
          onSelectSymbol(instrument)
          onSelectTimeframe(parsed.timeframe.value)
        }
        closePalette()
        break
      }
      default: {
        const _exhaustive: never = parsed
        return _exhaustive
      }
    }
  }

  const selectSearchResult = (inst: Instrument) => {
    onAddToWatchlist(inst)
    onSelectSymbol(inst)
    closePalette()
  }

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      closePalette()
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
        if (selectedItem.type === 'command') {
          executeCommand(selectedItem.parsed)
        } else if (selectedItem.type === 'timeframe') {
          onSelectTimeframe(selectedItem.value)
          closePalette()
        } else if (selectedItem.type === 'recent') {
          selectSearchResult(selectedItem.symbol)
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
    <div className="bg-espresso-950/45 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
      <div
        ref={overlayRef}
        className="quant-panel bg-carbon-900 border-brass-500/30 flex max-h-[400px] w-[480px] flex-col overflow-hidden rounded-xl border shadow-[0_0_50px_-12px_rgba(196,165,116,0.3)]"
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
          {query.trim() === '' && dropdownItems.length === 0 ? (
            <div className="text-silver-400 flex h-32 items-center justify-center font-mono text-xs">
              No recent symbols yet.
            </div>
          ) : query.trim() !== '' && searchResultsQuery.isLoading && dropdownItems.length === 0 ? (
            <div className="text-silver-400 flex h-32 flex-col items-center justify-center gap-2 font-mono text-xs">
              <Activity className="text-brass-500 h-6 w-6 animate-pulse" />
              <span>Searching symbols…</span>
            </div>
          ) : dropdownItems.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {dropdownItems.map((item, index) => {
                const isActive = index === selectedIndex

                if (item.type === 'command') {
                  return (
                    <div
                      key={`cmd-${item.label}`}
                      onClick={() => executeCommand(item.parsed)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 font-mono text-xs transition-all select-none ${
                        isActive
                          ? 'bg-brass-500/10 text-brass-400 border-brass-500/30 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_8px_rgba(196,165,116,0.1)]'
                          : 'text-silver-300 hover:bg-carbon-800/40 border-transparent'
                      }`}
                    >
                      <span className="text-silver-100 text-sm font-bold">{item.label}</span>
                      <span className="bg-carbon-950 border-carbon-700 text-brass-400 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase">
                        Command
                      </span>
                    </div>
                  )
                }

                if (item.type === 'timeframe') {
                  return (
                    <div
                      key={`tf-${item.value}`}
                      onClick={() => {
                        onSelectTimeframe(item.value)
                        closePalette()
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 font-mono text-xs transition-all select-none ${
                        isActive
                          ? 'bg-brass-500/10 text-brass-400 border-brass-500/30 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_8px_rgba(196,165,116,0.1)]'
                          : 'text-silver-300 hover:bg-carbon-800/40 border-transparent'
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

                const inst = item.type === 'recent' ? item.symbol : item.symbol
                const rowKey =
                  item.type === 'recent' ? `recent-${inst.symbol}` : `sym-${inst.symbol}`

                return (
                  <div
                    key={rowKey}
                    onClick={() => selectSearchResult(inst)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 font-mono text-xs transition-all select-none ${
                      isActive
                        ? 'bg-brass-500/10 text-brass-400 border-brass-500/30 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_8px_rgba(196,165,116,0.1)]'
                        : 'text-silver-300 hover:bg-carbon-800/40 border-transparent'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-silver-100 text-sm font-bold">
                        {highlightMatch(inst.symbol, liveEffectiveSearchQuery)}
                      </span>
                      <span className="text-silver-400 line-clamp-1 max-w-[300px] text-[10px]">
                        {inst.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      {item.type === 'recent' ? (
                        <span className="bg-carbon-950 border-carbon-700 text-silver-400 rounded border px-1.5 py-0.5 text-[10px] uppercase">
                          Recent
                        </span>
                      ) : null}
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
