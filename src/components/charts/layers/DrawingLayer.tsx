import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { DataPoint, DrawingObject, ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'
import { barCenterX } from '@/components/charts/hooks/useChartScales'

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 1]

type DrawingLayerProps = {
  drawings: DrawingObject[]
  draft: DrawingObject | null
  xScale: BandScale
  priceScale: LinearScale
  allBars: ProcessedBar[]
  layout: { priceTop: number; priceHeight: number; innerWidth: number }
  left: number
}

function pointToXY(
  point: DataPoint,
  xScale: BandScale,
  priceScale: LinearScale,
  bars: ProcessedBar[],
): { x: number; y: number } | null {
  const bar = bars.find((b) => b.timestamp === point.timestamp)
  if (!bar) {
    const idx = bars.findIndex(
      (b) => new Date(b.timestamp).getTime() >= new Date(point.timestamp).getTime(),
    )
    const fallback = bars[Math.max(0, idx)] ?? bars[bars.length - 1]
    if (!fallback) return null
    return {
      x: barCenterX(xScale, fallback.timestamp),
      y: priceScale(point.price),
    }
  }
  return {
    x: barCenterX(xScale, bar.timestamp),
    y: priceScale(point.price),
  }
}

function renderDrawing(
  drawing: DrawingObject,
  xScale: BandScale,
  priceScale: LinearScale,
  bars: ProcessedBar[],
  layout: { priceTop: number; priceHeight: number; innerWidth: number },
  left: number,
  isDraft = false,
) {
  const stroke = isDraft ? 'rgba(201, 162, 39, 0.7)' : BRASS_COLOR

  if (drawing.type === 'horizontal') {
    const y = priceScale(drawing.price)
    return (
      <line
        key={drawing.id}
        x1={left}
        x2={left + layout.innerWidth}
        y1={y}
        y2={y}
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray="6 3"
      />
    )
  }

  if (drawing.type === 'trendline') {
    const p1 = pointToXY(drawing.p1, xScale, priceScale, bars)
    const p2 = pointToXY(drawing.p2, xScale, priceScale, bars)
    if (!p1 || !p2) return null
    return (
      <line
        key={drawing.id}
        x1={left + p1.x}
        y1={p1.y}
        x2={left + p2.x}
        y2={p2.y}
        stroke={stroke}
        strokeWidth={1.5}
      />
    )
  }

  if (drawing.type === 'fibo') {
    const p1 = pointToXY(drawing.p1, xScale, priceScale, bars)
    const p2 = pointToXY(drawing.p2, xScale, priceScale, bars)
    if (!p1 || !p2) return null
    const priceHigh = Math.max(drawing.p1.price, drawing.p2.price)
    const priceLow = Math.min(drawing.p1.price, drawing.p2.price)
    const range = priceHigh - priceLow

    return (
      <g key={drawing.id}>
        {FIB_LEVELS.map((level) => {
          const price = priceHigh - range * level
          const y = priceScale(price)
          return (
            <g key={level}>
              <line
                x1={left}
                x2={left + layout.innerWidth}
                y1={y}
                y2={y}
                stroke={stroke}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.8}
              />
              <text x={left + 4} y={y - 2} fill="#9ca3af" fontSize={8} fontFamily="monospace">
                {(level * 100).toFixed(1)}%
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  if (drawing.type === 'text') {
    const pt = pointToXY(drawing.point, xScale, priceScale, bars)
    if (!pt) return null
    return (
      <text
        key={drawing.id}
        x={left + pt.x}
        y={pt.y}
        fill={BRASS_COLOR}
        fontSize={11}
        fontFamily="monospace"
      >
        {drawing.label}
      </text>
    )
  }

  return null
}

export function DrawingLayer({
  drawings,
  draft,
  xScale,
  priceScale,
  allBars,
  layout,
  left,
}: DrawingLayerProps) {
  return (
    <g>
      {drawings.map((d) => renderDrawing(d, xScale, priceScale, allBars, layout, left))}
      {draft && renderDrawing(draft, xScale, priceScale, allBars, layout, left, true)}
    </g>
  )
}
