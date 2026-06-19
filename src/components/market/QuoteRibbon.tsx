import { ChevronLeft, ChevronRight } from 'lucide-react'

import { FlashOnChange } from '@/components/shared/FlashOnChange'
import { formatPrice } from '@/lib/market/format'
import type { Instrument, MarketSnapshot, OhlcvBar } from '@/types/api'

import { ChangeBadge } from './ChangeBadge'
import { SkeletonBar } from './SkeletonBar'
import type { Mt5ConnectionStatus } from './types'

export type QuoteRibbonProps = {
  symbol: string
  instrument: Instrument | undefined
  activeBar: OhlcvBar | null
  snapshot: MarketSnapshot | undefined
  connectionStatus: Mt5ConnectionStatus
  priceDigits: number
  sidebarCollapsed: boolean
  detailCollapsed: boolean
  isLoadingInstrument?: boolean
  onToggleSidebar: () => void
  onToggleDetailPanel: () => void
}

function RibbonSkeleton() {
  return (
    <div className="border-carbon-700/60 flex flex-wrap items-center justify-between gap-4 border-b pb-3">
      <div className="flex items-center gap-3">
        <SkeletonBar className="h-8 w-8" />
        <div className="flex flex-col gap-1.5">
          <SkeletonBar className="h-6 w-24" />
          <SkeletonBar className="h-3 w-36" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <SkeletonBar className="h-8 w-64" />
        <SkeletonBar className="h-10 w-24" />
      </div>
    </div>
  )
}

export function QuoteRibbon({
  symbol,
  instrument,
  activeBar,
  snapshot,
  connectionStatus,
  priceDigits,
  sidebarCollapsed,
  detailCollapsed,
  isLoadingInstrument = false,
  onToggleSidebar,
  onToggleDetailPanel,
}: QuoteRibbonProps) {
  if (isLoadingInstrument && !instrument) {
    return <RibbonSkeleton />
  }

  return (
    <div className="border-carbon-700/60 flex flex-wrap items-center justify-between gap-4 border-b pb-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="border-carbon-700 bg-carbon-800 text-silver-300 hover:bg-carbon-700 flex h-8 w-8 items-center justify-center rounded border transition-all active:scale-95"
          title="Toggle Market Watch Panel"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-silver-100 font-mono text-xl font-bold tracking-tight">{symbol}</h1>
            <span className="bg-carbon-800 text-silver-400 border-carbon-700 rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase">
              {instrument?.exchange || 'MT5'}
            </span>
            {connectionStatus === 'live' && (
              <span className="flex items-center gap-1 font-mono text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
                <span className="live-status-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live
              </span>
            )}
            {connectionStatus === 'offline' && (
              <span
                className={`flex items-center gap-1 font-mono text-[10px] font-semibold tracking-wider uppercase ${
                  instrument?.exchange === 'LOCAL' ? 'text-silver-400' : 'text-rose-400'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    instrument?.exchange === 'LOCAL' ? 'bg-silver-400' : 'bg-rose-400'
                  }`}
                />
                {instrument?.exchange === 'LOCAL' ? 'Historical' : 'MT5 Offline'}
              </span>
            )}
            {connectionStatus === 'connecting' && (
              <span className="text-silver-400 flex animate-pulse items-center gap-1 font-mono text-[10px] font-semibold tracking-wider uppercase">
                <span className="bg-silver-400 h-1.5 w-1.5 rounded-full" />
                Connecting…
              </span>
            )}
          </div>
          <p className="text-silver-400 text-xs">{instrument?.name || 'Loading details…'}</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="border-brass-600/15 bg-carbon-950/80 text-silver-400 quant-tabular-nums flex flex-wrap items-center gap-x-5 gap-y-1 rounded-full border px-4 py-1.5 font-mono text-xs shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
          <div>
            <span className="text-silver-500 text-[10px] font-semibold">O</span>{' '}
            <span className="text-silver-200">
              {activeBar ? formatPrice(activeBar.open, priceDigits) : '—'}
            </span>
          </div>
          <div>
            <span className="text-silver-500 text-[10px] font-semibold">H</span>{' '}
            <span className="text-emerald-400">
              {activeBar ? formatPrice(activeBar.high, priceDigits) : '—'}
            </span>
          </div>
          <div>
            <span className="text-silver-500 text-[10px] font-semibold">L</span>{' '}
            <span className="text-rose-400">
              {activeBar ? formatPrice(activeBar.low, priceDigits) : '—'}
            </span>
          </div>
          <div>
            <span className="text-silver-500 text-[10px] font-semibold">C</span>{' '}
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
          <div className="border-carbon-800 mx-1 hidden h-3 border-l sm:block" />
          <div className="hidden sm:block">
            <span className="text-silver-500 text-[10px] font-semibold">VOL</span>{' '}
            <span className="text-silver-200">
              {activeBar ? activeBar.volume.toLocaleString() : '—'}
            </span>
          </div>
        </div>

        {snapshot && (
          <div className="border-carbon-800 flex items-center gap-3 border-l pl-4">
            <div className="text-right">
              <FlashOnChange value={snapshot.last}>
                <p className="text-silver-100 quant-tabular-nums font-mono text-base font-bold">
                  {formatPrice(snapshot.last, priceDigits)}
                </p>
              </FlashOnChange>
              <ChangeBadge changePct={snapshot.changePct} className="text-xs font-medium" />
            </div>
          </div>
        )}

        <button
          onClick={onToggleDetailPanel}
          className="border-carbon-700 bg-carbon-800 text-silver-300 hover:bg-carbon-700 flex h-8 w-8 items-center justify-center rounded border transition-all active:scale-95"
          title="Toggle Quote Panel"
        >
          {detailCollapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}
