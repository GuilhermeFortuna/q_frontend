import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { DataPoint, ProcessedBar } from '@/components/charts/types/chart'
import { BEAR_COLOR, BULL_COLOR } from '@/components/charts/types/chart'
import { formatRulerDuration, type RulerMeasurement } from '@/components/charts/ruler'
import { pointToXY } from '@/components/charts/hooks/useChartScales'

const RULER_COLOR = '#6eb5ff'
const LABEL_WIDTH = 132
const LABEL_HEIGHT = 34
const LABEL_GAP = 10

type RulerLayerProps = {
  start: DataPoint
  end: DataPoint
  measurement: RulerMeasurement
  xScale: BandScale
  priceScale: LinearScale
  allBars: ProcessedBar[]
  layout: { priceTop: number; priceHeight: number; innerWidth: number }
  left: number
  /** Decimal places for the price delta, from the instrument's precision. */
  digits?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`
}

export function RulerLayer({
  start,
  end,
  measurement,
  xScale,
  priceScale,
  allBars,
  layout,
  left,
  digits = 2,
}: RulerLayerProps) {
  const p1 = pointToXY(start, xScale, priceScale, allBars)
  const p2 = pointToXY(end, xScale, priceScale, allBars)
  if (!p1 || !p2) return null

  const x1 = left + p1.x
  const x2 = left + p2.x
  const chartRight = left + layout.innerWidth
  const chartBottom = layout.priceTop + layout.priceHeight
  const deltaColor = measurement.priceDelta >= 0 ? BULL_COLOR : BEAR_COLOR

  // The label sits beside the end point and flips to the other side near the right edge.
  const labelOnRight = x2 + LABEL_GAP + LABEL_WIDTH <= chartRight
  const labelX = clamp(
    labelOnRight ? x2 + LABEL_GAP : x2 - LABEL_GAP - LABEL_WIDTH,
    left,
    chartRight - LABEL_WIDTH,
  )
  const labelY = clamp(p2.y - LABEL_HEIGHT / 2, layout.priceTop, chartBottom - LABEL_HEIGHT)

  return (
    <g data-testid="chart-ruler" pointerEvents="none">
      <rect
        x={Math.min(x1, x2)}
        y={Math.min(p1.y, p2.y)}
        width={Math.abs(x2 - x1)}
        height={Math.abs(p2.y - p1.y)}
        fill={RULER_COLOR}
        fillOpacity={0.08}
        stroke={RULER_COLOR}
        strokeOpacity={0.5}
        strokeDasharray="3 3"
      />
      <line x1={x1} y1={p1.y} x2={x2} y2={p2.y} stroke={RULER_COLOR} strokeWidth={1.2} />
      <circle cx={x1} cy={p1.y} r={3} fill={RULER_COLOR} />
      <circle cx={x2} cy={p2.y} r={3} fill={RULER_COLOR} />
      <rect
        x={labelX}
        y={labelY}
        width={LABEL_WIDTH}
        height={LABEL_HEIGHT}
        rx={3}
        fill="#0b0d10"
        fillOpacity={0.9}
        stroke={RULER_COLOR}
        strokeOpacity={0.5}
      />
      <text
        x={labelX + 7}
        y={labelY + 14}
        fill={deltaColor}
        fontSize={10}
        fontFamily="monospace"
        data-testid="chart-ruler-price"
      >
        {`${signed(measurement.priceDelta, digits)} (${signed(measurement.percentDelta, 2)}%)`}
      </text>
      <text
        x={labelX + 7}
        y={labelY + 27}
        fill="#c0c6cf"
        fontSize={9}
        fontFamily="monospace"
        data-testid="chart-ruler-span"
      >
        {`${measurement.bars} ${measurement.bars === 1 ? 'bar' : 'bars'} · ${formatRulerDuration(measurement.durationMs)}`}
      </text>
    </g>
  )
}
