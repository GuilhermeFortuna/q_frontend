import { useMemo, useState } from 'react'
import { Minus, Search } from 'lucide-react'

import { FlashOnChange } from '@/components/shared/FlashOnChange'
import { formatPrice } from '@/lib/market/format'
import type { Instrument, MarketSnapshot } from '@/types/api'

export type MarketWatchPanelProps = {
  watchlist: Instrument[]
  snapshotsBySymbol: Record<string, MarketSnapshot>
  selectedSymbol: string
  isLoadingInstruments: boolean
  mt5SearchResults: Instrument[]
  mt5SearchLoading: boolean
  onSelectSymbol: (symbol: string) => void
  onAddInstrument: (instrument: Instrument) => void
  onRemoveInstrument: (symbol: string) => void
}

export function MarketWatchPanel({
  watchlist,
  snapshotsBySymbol,
  selectedSymbol,
  isLoadingInstruments,
  mt5SearchResults,
  mt5SearchLoading,
  onSelectSymbol,
  onAddInstrument,
  onRemoveInstrument,
}: MarketWatchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredInstruments = useMemo(() => {
    return watchlist.filter(
      (inst) =>
        inst.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [watchlist, searchQuery])

  return (
    <div className="quant-panel flex h-full flex-col overflow-hidden rounded-lg">
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
        {isLoadingInstruments && watchlist.length === 0 ? (
          <div className="text-silver-400 flex h-32 items-center justify-center text-xs">
            Loading assets…
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredInstruments.length > 0 ? (
              filteredInstruments.map((inst) => {
                const isSelected = inst.symbol === selectedSymbol
                const rowSnap = snapshotsBySymbol[inst.symbol]
                const rowDigits = rowSnap?.digits ?? 2

                return (
                  <div
                    key={inst.symbol}
                    onClick={() => onSelectSymbol(inst.symbol)}
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

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveInstrument(inst.symbol)
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

            {searchQuery.trim().length > 1 && (
              <div className="border-carbon-700/60 mt-3 border-t pt-3">
                <p className="text-brass-400 mb-2 px-3.5 text-[10px] font-bold tracking-wider uppercase">
                  MetaTrader Search
                </p>
                {mt5SearchLoading ? (
                  <div className="text-silver-400 flex h-16 items-center justify-center font-mono text-xs">
                    Searching MT5…
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
  )
}
