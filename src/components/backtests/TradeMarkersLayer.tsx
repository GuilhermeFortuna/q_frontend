import { useMemo } from 'react'

import { barCenterX } from '@/components/charts/hooks/useChartScales'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import { BULL_COLOR, BEAR_COLOR } from '@/components/charts/types/chart'
import type { Trade } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

type TradeMarkersLayerProps = {
  trades: Trade[]
  allBars: OhlcvBar[]
  visibleTimestamps: Set<string>
  xScale: BandScale
  yScale: LinearScale
  left: number
  hoveredTradeId?: string | null
  onTradeHover?: (trade: Trade | null, event?: React.MouseEvent) => void
}

type PlacedTrade = {
  trade: Trade
  entryTimestamp: string | null
  exitTimestamp: string | null
}

const ENTRY_MARKER_SIZE = 8
const EXIT_MARKER_RADIUS = 6
const MARKER_STROKE = '#07101c'

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

function tradeLineColor(pnl: number | null): string {
  if (pnl == null) return 'rgba(154, 161, 172, 0.35)'
  if (pnl > 0) return 'rgba(74, 222, 128, 0.55)'
  if (pnl < 0) return 'rgba(248, 113, 113, 0.55)'
  return 'rgba(154, 161, 172, 0.35)'
}

function exitReasonMarkerLabel(exitReason?: string | null): string {
  if (!exitReason) return ''

  const reason = exitReason.toUpperCase()
  if (reason === 'STOP_LOSS' || reason === 'SL' || reason === 'FIXED_SL') return 'SL'
  if (reason === 'ATR_SL') return 'AS'
  if (reason === 'TAKE_PROFIT' || reason === 'TP' || reason === 'FIXED_TP') return 'TP'
  if (reason === 'ATR_TP') return 'AT'
  if (reason === 'TRAILING_STOP' || reason === 'TRAILING') return 'TS'
  if (reason === 'CHANDELIER') return 'CH'
  if (reason === 'BREAKEVEN') return 'BE'
  if (reason === 'PSAR') return 'PS'
  if (reason === 'PROFIT_TARGET_RATCHET') return 'PR'
  if (reason === 'TIME_STOP') return 'TI'
  if (reason === 'DONCHIAN_STOP') return 'DC'
  if (reason.includes('SIGNAL')) return 'S'
  if (reason.includes('END_OF_DAY')) return 'D'
  if (reason.includes('FORCE_CLOSE') || reason.includes('FORCE')) return 'F'

  return ''
}

function EntryMarker({ x, y, isBuy }: { x: number; y: number; isBuy: boolean }) {
  const color = isBuy ? BULL_COLOR : BEAR_COLOR
  const size = ENTRY_MARKER_SIZE
  const points = isBuy
    ? `${x},${y + size} ${x - size},${y - size} ${x + size},${y - size}`
    : `${x},${y - size} ${x - size},${y + size} ${x + size},${y + size}`

  return (
    <polygon
      points={points}
      fill={color}
      stroke={MARKER_STROKE}
      strokeWidth={1.5}
      style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.65))' }}
    />
  )
}

function ExitMarker({
  x,
  y,
  isBuy,
  exitReason,
}: {
  x: number
  y: number
  isBuy: boolean
  exitReason?: string | null
}) {
  const fillColor = isBuy ? 'rgba(0, 192, 118, 0.85)' : 'rgba(255, 59, 48, 0.85)'
  const strokeColor = isBuy ? BULL_COLOR : BEAR_COLOR
  const letter = exitReasonMarkerLabel(exitReason)

  const radius = letter ? EXIT_MARKER_RADIUS + 2.5 : EXIT_MARKER_RADIUS

  return (
    <g style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.65))' }}>
      <circle cx={x} cy={y} r={radius} fill={fillColor} stroke={strokeColor} strokeWidth={2} />
      {letter && (
        <text
          x={x}
          y={y}
          dy="0.31em"
          textAnchor="middle"
          fill="#07101c"
          fontSize="8px"
          fontWeight="bold"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {letter}
        </text>
      )}
    </g>
  )
}

export function TradeMarkersLayer({
  trades,
  allBars,
  visibleTimestamps,
  xScale,
  yScale,
  left,
  hoveredTradeId,
  onTradeHover,
}: TradeMarkersLayerProps) {
  const placedTrades = useMemo<PlacedTrade[]>(() => {
    return trades.map((trade) => ({
      trade,
      entryTimestamp: findBarTimestamp(allBars, trade.entry_time),
      exitTimestamp:
        trade.exit_time && trade.exit_price != null
          ? findBarTimestamp(allBars, trade.exit_time)
          : null,
    }))
  }, [trades, allBars])

  return (
    <g transform={`translate(${left}, 0)`} style={{ pointerEvents: 'all' }}>
      {placedTrades.map(({ trade, entryTimestamp, exitTimestamp }) => {
        const entryVisible = entryTimestamp != null && visibleTimestamps.has(entryTimestamp)
        const exitVisible = exitTimestamp != null && visibleTimestamps.has(exitTimestamp)

        if (!entryVisible && !exitVisible) return null

        const isBuy = trade.action === 'BUY'
        const isHovered = hoveredTradeId === trade.id
        const hasCompleteTrade =
          entryTimestamp != null &&
          exitTimestamp != null &&
          trade.exit_price != null &&
          entryVisible &&
          exitVisible

        const entryX = entryTimestamp != null ? barCenterX(xScale, entryTimestamp) : 0
        const entryY = yScale(trade.entry_price)
        const exitX =
          exitTimestamp != null && trade.exit_price != null
            ? barCenterX(xScale, exitTimestamp)
            : null
        const exitY = trade.exit_price != null ? yScale(trade.exit_price) : null

        const handleEnter = (event: React.MouseEvent) => onTradeHover?.(trade, event)
        const handleMove = (event: React.MouseEvent) => onTradeHover?.(trade, event)
        const handleLeave = () => onTradeHover?.(null)

        return (
          <g
            key={trade.id}
            onMouseEnter={handleEnter}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            style={{ cursor: 'pointer' }}
          >
            {hasCompleteTrade && exitX != null && exitY != null && (
              <>
                <line
                  x1={entryX}
                  y1={entryY}
                  x2={exitX}
                  y2={exitY}
                  stroke="transparent"
                  strokeWidth={14}
                  pointerEvents="stroke"
                />
                <line
                  x1={entryX}
                  y1={entryY}
                  x2={exitX}
                  y2={exitY}
                  stroke={tradeLineColor(trade.pnl)}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  strokeDasharray={isHovered ? undefined : '4 3'}
                  pointerEvents="none"
                />
              </>
            )}

            {entryVisible && (
              <>
                <circle
                  cx={entryX}
                  cy={entryY}
                  r={ENTRY_MARKER_SIZE + 4}
                  fill="transparent"
                  pointerEvents="all"
                />
                <EntryMarker x={entryX} y={entryY} isBuy={isBuy} />
              </>
            )}

            {exitVisible && exitX != null && exitY != null && (
              <>
                <circle
                  cx={exitX}
                  cy={exitY}
                  r={EXIT_MARKER_RADIUS + 5}
                  fill="transparent"
                  pointerEvents="all"
                />
                <ExitMarker x={exitX} y={exitY} isBuy={isBuy} exitReason={trade.exit_reason} />
              </>
            )}
          </g>
        )
      })}
    </g>
  )
}
