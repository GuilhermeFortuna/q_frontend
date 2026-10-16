import { memo, useCallback, useMemo, type PointerEvent } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import type { ProcessedBar } from '@/components/charts/types/chart'
import type { MarketVolumeProfileSegment } from '../../../../contracts/api'
import { sessionDayKey } from '@/lib/market/volumeProfileConfig'

export type VolumeProfileHoverRow = {
  price: number
  total: number
  buy: number
  sell: number
  unknown: number
  delta: number
}

type VolumeProfileLayerProps = {
  segments: MarketVolumeProfileSegment[]
  segmentMode: 'session' | 'visibleRange'
  allBars: ProcessedBar[]
  visibleBars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  left: number
  innerWidth: number
  priceTop: number
  priceHeight: number
  widthPercent: number
  splitBuySell: boolean
  rowSize: number | null | undefined
  onHoverRow: (row: VolumeProfileHoverRow | null) => void
}

type RowGeom = {
  key: string
  x: number
  y: number
  height: number
  width: number
  buyWidth: number
  sellWidth: number
  unknownWidth: number
  row: VolumeProfileHoverRow
  inValueArea: boolean
  isPoc: boolean
}

function segmentSessionKey(segment: MarketVolumeProfileSegment): string {
  return sessionDayKey(segment.start)
}

function barsForSession(
  allBars: ProcessedBar[],
  segment: MarketVolumeProfileSegment,
): ProcessedBar[] {
  const key = segmentSessionKey(segment)
  return allBars.filter((bar) => sessionDayKey(bar.timestamp) === key)
}

function xForBar(xScale: BandScale, left: number, bar: ProcessedBar): number {
  const band = xScale(bar.timestamp)
  return left + (band ?? 0)
}

function VolumeProfileLayerImpl({
  segments,
  segmentMode,
  allBars,
  visibleBars,
  xScale,
  yScale,
  left,
  innerWidth,
  priceTop,
  priceHeight,
  widthPercent,
  splitBuySell,
  rowSize,
  onHoverRow,
}: VolumeProfileLayerProps) {
  const [yMin, yMax] = yScale.domain()
  const tick = rowSize && rowSize > 0 ? rowSize : 0.01
  const maxProfileWidth = innerWidth * (widthPercent / 100)
  const bandwidth = xScale.bandwidth()

  const visibleSessionKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const bar of visibleBars) keys.add(sessionDayKey(bar.timestamp))
    return keys
  }, [visibleBars])

  const geoms = useMemo(() => {
    const out: RowGeom[] = []
    const segmentsToDraw =
      segmentMode === 'visibleRange'
        ? segments.slice(0, 1)
        : segments.filter((segment) => visibleSessionKeys.has(segmentSessionKey(segment)))

    for (const segment of segmentsToDraw) {
      const prices = segment.rows.price
      const buys = segment.rows.buy
      const sells = segment.rows.sell
      const unknowns = segment.rows.unknown
      if (!prices.length) continue

      let maxTotal = 0
      for (let i = 0; i < prices.length; i += 1) {
        const total = buys[i] + sells[i] + unknowns[i]
        if (total > maxTotal) maxTotal = total
      }
      if (maxTotal <= 0) continue

      let xStart = left
      let xEnd = left + innerWidth

      if (segmentMode === 'visibleRange') {
        xEnd = left + innerWidth
        xStart = xEnd - maxProfileWidth
      } else {
        const sessionBars = barsForSession(allBars, segment)
        if (!sessionBars.length) continue
        const first = sessionBars[0]
        const last = sessionBars[sessionBars.length - 1]
        xStart = xForBar(xScale, left, first)
        const lastX = xForBar(xScale, left, last)
        xEnd = Math.min(xStart + maxProfileWidth, lastX + bandwidth)
      }

      const profileWidth = Math.max(0, xEnd - xStart)

      for (let i = 0; i < prices.length; i += 1) {
        const price = prices[i]
        const buy = buys[i]
        const sell = sells[i]
        const unknown = unknowns[i]
        const total = buy + sell + unknown
        if (total <= 0) continue
        if (price + tick / 2 < yMin || price - tick / 2 > yMax) continue

        const y = yScale(price)
        const height = Math.max(2, Math.abs(yScale(price - tick / 2) - yScale(price + tick / 2)))
        const width = (total / maxTotal) * profileWidth
        const buyWidth = splitBuySell ? (buy / total) * width : 0
        const sellWidth = splitBuySell ? (sell / total) * width : 0
        const unknownWidth = splitBuySell ? (unknown / total) * width : 0
        const inValueArea = price >= segment.val && price <= segment.vah
        const isPoc = Math.abs(price - segment.poc) <= tick / 2

        out.push({
          key: `${segment.start}-${price}`,
          x: segmentMode === 'visibleRange' ? xEnd - width : xStart,
          y: y - height / 2,
          height,
          width,
          buyWidth,
          sellWidth,
          unknownWidth,
          row: { price, total, buy, sell, unknown, delta: buy - sell },
          inValueArea,
          isPoc,
        })
      }
    }
    return out
  }, [
    allBars,
    innerWidth,
    left,
    maxProfileWidth,
    segmentMode,
    segments,
    splitBuySell,
    tick,
    visibleSessionKeys,
    xScale,
    yScale,
    yMax,
    yMin,
    bandwidth,
  ])

  const levelMarks = useMemo(() => {
    const marks: Array<{ y: number; label: string; price: number }> = []
    const segmentsToDraw =
      segmentMode === 'visibleRange'
        ? segments.slice(0, 1)
        : segments.filter((segment) => visibleSessionKeys.has(segmentSessionKey(segment)))
    for (const segment of segmentsToDraw) {
      for (const [label, price] of [
        ['POC', segment.poc],
        ['VAH', segment.vah],
        ['VAL', segment.val],
      ] as const) {
        if (price < yMin || price > yMax) continue
        marks.push({ y: yScale(price), label, price })
      }
    }
    return marks
  }, [segmentMode, segments, visibleSessionKeys, yMax, yMin, yScale])

  const clearHover = useCallback(() => onHoverRow(null), [onHoverRow])

  const handleRowEnter = useCallback(
    (row: VolumeProfileHoverRow) => (event: PointerEvent) => {
      event.stopPropagation()
      onHoverRow(row)
    },
    [onHoverRow],
  )

  if (!geoms.length) return null

  return (
    <g data-testid="volume-profile-layer" pointerEvents="none" onMouseLeave={clearHover}>
      <rect
        x={left}
        y={priceTop}
        width={innerWidth}
        height={priceHeight}
        fill="transparent"
        pointerEvents="all"
        onMouseLeave={clearHover}
      />
      {geoms.map((geom) => (
        <g key={geom.key} pointerEvents="all">
          {splitBuySell ? (
            <>
              <rect
                x={geom.x}
                y={geom.y}
                width={geom.buyWidth}
                height={geom.height}
                fill={geom.inValueArea ? 'rgba(38, 166, 154, 0.55)' : 'rgba(38, 166, 154, 0.28)'}
                data-testid={geom.isPoc ? 'volume-profile-poc-row' : undefined}
              />
              <rect
                x={geom.x + geom.buyWidth}
                y={geom.y}
                width={geom.sellWidth}
                height={geom.height}
                fill={geom.inValueArea ? 'rgba(239, 83, 80, 0.55)' : 'rgba(239, 83, 80, 0.28)'}
              />
              <rect
                x={geom.x + geom.buyWidth + geom.sellWidth}
                y={geom.y}
                width={geom.unknownWidth}
                height={geom.height}
                fill={geom.inValueArea ? 'rgba(156, 163, 175, 0.5)' : 'rgba(156, 163, 175, 0.25)'}
              />
            </>
          ) : (
            <rect
              x={geom.x}
              y={geom.y}
              width={geom.width}
              height={geom.height}
              fill={
                geom.isPoc
                  ? 'rgba(201, 162, 39, 0.75)'
                  : geom.inValueArea
                    ? 'rgba(110, 181, 255, 0.45)'
                    : 'rgba(110, 181, 255, 0.22)'
              }
              data-testid={geom.isPoc ? 'volume-profile-poc-row' : undefined}
            />
          )}
          <rect
            x={geom.x}
            y={geom.y}
            width={Math.max(geom.width, 4)}
            height={geom.height}
            fill="transparent"
            onPointerEnter={handleRowEnter(geom.row)}
          />
        </g>
      ))}
      {levelMarks.map((mark) => (
        <line
          key={`${mark.label}-${mark.price}`}
          x1={left}
          x2={left + innerWidth}
          y1={mark.y}
          y2={mark.y}
          stroke={mark.label === 'POC' ? '#c9a227' : 'rgba(201, 162, 39, 0.35)'}
          strokeWidth={mark.label === 'POC' ? 1.2 : 0.8}
          strokeDasharray={mark.label === 'POC' ? undefined : '4 3'}
          data-testid={`volume-profile-level-${mark.label.toLowerCase()}`}
        />
      ))}
    </g>
  )
}

export const VolumeProfileLayer = memo(VolumeProfileLayerImpl)
