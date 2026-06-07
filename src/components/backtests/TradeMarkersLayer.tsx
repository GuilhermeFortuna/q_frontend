import { useMemo } from 'react'

import { barCenterX } from '@/components/charts/hooks/useChartScales'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import { BULL_COLOR, BEAR_COLOR } from '@/components/charts/types/chart'
import { formatCurrency, formatSignedCurrency } from '@/components/backtests/chartUtils'
import type { Trade } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

type TradeMarkersLayerProps = {
  trades: Trade[]
  allBars: OhlcvBar[]
  visibleTimestamps: Set<string>
  xScale: BandScale
  yScale: LinearScale
  left: number
}

function findBarTimestamp(allBars: OhlcvBar[], tradeTime: string): string | null {
  const targetMs = new Date(tradeTime).getTime()
  let closest: OhlcvBar | null = null
  let minDist = Infinity

  for (const bar of allBars) {
    const dist = Math.abs(new Date(bar.timestamp).getTime() - targetMs)
    if (dist < minDist) {
      minDist = dist
      closest = bar
    }
  }

  return closest?.timestamp ?? null
}

export function TradeMarkersLayer({
  trades,
  allBars,
  visibleTimestamps,
  xScale,
  yScale,
  left,
}: TradeMarkersLayerProps) {
  const markers = useMemo(() => {
    return trades.flatMap((trade) => {
      const items: Array<{
        id: string
        timestamp: string
        price: number
        kind: 'entry' | 'exit'
        action: Trade['action']
        pnl: number | null
      }> = []

      const entryTs = findBarTimestamp(allBars, trade.entry_time)
      if (entryTs) {
        items.push({
          id: `${trade.id}-entry`,
          timestamp: entryTs,
          price: trade.entry_price,
          kind: 'entry',
          action: trade.action,
          pnl: trade.pnl,
        })
      }

      if (trade.exit_time && trade.exit_price != null) {
        const exitTs = findBarTimestamp(allBars, trade.exit_time)
        if (exitTs) {
          items.push({
            id: `${trade.id}-exit`,
            timestamp: exitTs,
            price: trade.exit_price,
            kind: 'exit',
            action: trade.action,
            pnl: trade.pnl,
          })
        }
      }

      return items
    })
  }, [trades, allBars])

  return (
    <g transform={`translate(${left}, 0)`}>
      {markers.map((marker) => {
        if (!visibleTimestamps.has(marker.timestamp)) return null

        const x = barCenterX(xScale, marker.timestamp)
        const y = yScale(marker.price)
        const isBuy = marker.action === 'BUY'
        const entryColor = isBuy ? BULL_COLOR : BEAR_COLOR
        const exitColor = isBuy ? 'rgba(0, 192, 118, 0.55)' : 'rgba(255, 59, 48, 0.55)'

        if (marker.kind === 'entry') {
          const size = 5
          const points = isBuy
            ? `${x},${y + size} ${x - size},${y - size} ${x + size},${y - size}`
            : `${x},${y - size} ${x - size},${y + size} ${x + size},${y + size}`

          return (
            <g key={marker.id}>
              <polygon points={points} fill={entryColor} stroke="#07101c" strokeWidth={0.5} />
              <title>
                {`${marker.kind.toUpperCase()} ${marker.action} @ ${formatCurrency(marker.price)}`}
              </title>
            </g>
          )
        }

        return (
          <g key={marker.id}>
            <circle cx={x} cy={y} r={4} fill={exitColor} stroke={entryColor} strokeWidth={1.2} />
            <title>
              {`${marker.kind.toUpperCase()} ${marker.action} @ ${formatCurrency(marker.price)}${marker.pnl != null ? ` | PnL ${formatSignedCurrency(marker.pnl)}` : ''}`}
            </title>
          </g>
        )
      })}
    </g>
  )
}
