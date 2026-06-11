import { formatDisplayTimeSeconds } from '@/lib/formatDate'
import { useMemo } from 'react'

import { useRecentTicks } from '@/api/queries/market-data'
import { useStickToTopScroll } from '@/hooks/useStickToTopScroll'
import { formatPrice } from '@/lib/market/format'

import { getTickDisplayPrice, getTickPriceColorClass } from './timeAndSalesUtils'

const MAX_ROWS = 200

type TimeAndSalesPanelProps = {
  symbol: string
  enabled: boolean
  priceDigits?: number
}

export function TimeAndSalesPanel({ symbol, enabled, priceDigits = 2 }: TimeAndSalesPanelProps) {
  const ticksQuery = useRecentTicks(symbol, { enabled })
  const ticks = ticksQuery.data?.ticks

  const displayTicks = useMemo(() => {
    const source = ticks ?? []
    const capped = source.slice(-MAX_ROWS)
    return [...capped].reverse()
  }, [ticks])

  const { scrollRef, pendingNew, handleScroll, jumpToTop } = useStickToTopScroll(
    displayTicks.length,
  )

  if (ticksQuery.isLoading && displayTicks.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-2 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-carbon-800 h-4 animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (displayTicks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-silver-500 font-mono text-xs">No trades in feed.</p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {pendingNew > 0 && (
        <button
          type="button"
          onClick={jumpToTop}
          className="border-brass-500/40 bg-carbon-900/95 text-brass-400 absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase shadow-lg"
        >
          ↑ {pendingNew} new
        </button>
      )}

      <div className="border-carbon-700/60 bg-carbon-950/35 grid grid-cols-[1fr_1fr_1fr] gap-2 border-b px-3 py-2">
        <span className="text-silver-500 font-mono text-[10px] tracking-wider uppercase">Time</span>
        <span className="text-silver-500 text-right font-mono text-[10px] tracking-wider uppercase">
          Price
        </span>
        <span className="text-silver-500 text-right font-mono text-[10px] tracking-wider uppercase">
          Size
        </span>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
        {displayTicks.map((tick, index) => {
          const price = getTickDisplayPrice(tick)
          const olderTick = displayTicks[index + 1]
          const previousPrice = olderTick ? getTickDisplayPrice(olderTick) : null
          const priceColor = getTickPriceColorClass(tick, previousPrice, price)

          return (
            <div
              key={`${tick.timestamp}-${index}`}
              className="border-carbon-800/30 hover:bg-carbon-800/20 grid grid-cols-[1fr_1fr_1fr] gap-2 border-b px-3 py-1.5 transition-all duration-150"
            >
              <span className="text-silver-300 font-mono text-xs tabular-nums">
                {formatDisplayTimeSeconds(tick.timestamp)}
              </span>
              <span className={`text-right font-mono text-xs tabular-nums ${priceColor}`}>
                {formatPrice(price, priceDigits)}
              </span>
              <span className="text-silver-300 text-right font-mono text-xs tabular-nums">
                {tick.volume.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
