import { format, parseISO } from 'date-fns'

import { FlashOnChange } from '@/components/shared/FlashOnChange'
import { formatPrice } from '@/lib/market/format'
import { computeDayRangeMarkerPosition } from '@/lib/market/dayRange'
import type { MarketSnapshot } from '@/types/api'

type QuotePanelProps = {
  snapshot: MarketSnapshot | undefined
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`bg-carbon-800 animate-pulse rounded ${className}`} />
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-silver-500 font-mono text-[10px] tracking-wider uppercase">
        {label}
      </span>
      <span className="text-silver-200 font-mono text-xs tabular-nums">{value}</span>
    </div>
  )
}

export function QuotePanel({ snapshot }: QuotePanelProps) {
  if (!snapshot) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <SkeletonBar className="h-8 w-32 self-end" />
        <SkeletonBar className="h-4 w-24 self-end" />
        <div className="grid grid-cols-3 gap-3 pt-2">
          <SkeletonBar className="h-5" />
          <SkeletonBar className="h-5" />
          <SkeletonBar className="h-5" />
        </div>
        <SkeletonBar className="mt-2 h-2 w-full" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonBar key={index} className="h-4" />
          ))}
        </div>
      </div>
    )
  }

  const digits = snapshot.digits
  const isUp = snapshot.changeAbs >= 0
  const markerPosition = computeDayRangeMarkerPosition(
    snapshot.last,
    snapshot.dayLow,
    snapshot.dayHigh,
  )
  const lastUpdate = snapshot.tickTime ? format(parseISO(snapshot.tickTime), 'HH:mm:ss') : '—'

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <div className="text-right">
        <FlashOnChange value={snapshot.last}>
          <p className="text-silver-100 font-mono text-2xl font-bold tabular-nums">
            {formatPrice(snapshot.last, digits)}
          </p>
        </FlashOnChange>
        <p
          className={`mt-1 font-mono text-xs font-medium tabular-nums ${
            isUp ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {isUp ? '▲ +' : '▼ '}
          {formatPrice(Math.abs(snapshot.changeAbs), digits)} ({isUp ? '+' : ''}
          {snapshot.changePct.toFixed(2)}%)
        </p>
      </div>

      <div className="border-brass-600/10 bg-carbon-950/40 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border p-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
        <div className="text-right">
          <p className="text-silver-500 mb-0.5 font-mono text-[10px] tracking-wider uppercase">
            Bid
          </p>
          <p className="font-mono text-sm font-semibold text-rose-400 tabular-nums">
            {formatPrice(snapshot.bid, digits)}
          </p>
        </div>
        <div className="px-2 text-center">
          <p className="text-silver-500 mb-0.5 font-mono text-[10px] tracking-wider uppercase">
            Spread
          </p>
          <p className="text-silver-400 font-mono text-xs tabular-nums">
            {formatPrice(snapshot.spread, digits)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-silver-500 mb-0.5 font-mono text-[10px] tracking-wider uppercase">
            Ask
          </p>
          <p className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">
            {formatPrice(snapshot.ask, digits)}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="bg-carbon-950/60 border-carbon-800/60 relative h-1.5 overflow-hidden rounded-full border">
          <div className="via-brass-500/20 absolute inset-y-0 left-0 w-full bg-gradient-to-r from-rose-500/20 to-emerald-500/20" />
        </div>
        <div className="relative -mt-2 h-2.5">
          <div
            className="bg-brass-400 border-carbon-950 absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-[0_0_8px_rgba(196,165,116,0.85)]"
            style={{ left: `${markerPosition}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between">
          <span className="font-mono text-[10px] text-rose-400 tabular-nums">
            {formatPrice(snapshot.dayLow, digits)}
          </span>
          <span className="font-mono text-[10px] text-emerald-400 tabular-nums">
            {formatPrice(snapshot.dayHigh, digits)}
          </span>
        </div>
      </div>

      <div className="border-brass-600/10 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3">
        <StatRow label="Open" value={formatPrice(snapshot.dayOpen, digits)} />
        <StatRow label="Prev Close" value={formatPrice(snapshot.prevClose, digits)} />
        <StatRow label="Day High" value={formatPrice(snapshot.dayHigh, digits)} />
        <StatRow label="Day Low" value={formatPrice(snapshot.dayLow, digits)} />
        <StatRow label="Volume" value={snapshot.volume.toLocaleString()} />
        <StatRow label="Last Update" value={lastUpdate} />
      </div>
    </div>
  )
}
