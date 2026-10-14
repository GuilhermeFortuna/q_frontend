import type { ReactNode } from 'react'
import type { ChartMarker } from '@/components/charts/types/chart'
import type { LinearScale } from '@/components/charts/types/scales'
import type { StudyMarkerShape } from '@/lib/market/buildIndicatorRenderModel'
import { BEAR_COLOR, BULL_COLOR } from '@/components/charts/types/chart'

export function studyMarkerShape(
  shape: StudyMarkerShape,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const h = size / 2
  switch (shape) {
    case 'square':
      return <rect x={cx - h} y={cy - h} width={size} height={size} fill={color} />
    case 'diamond':
      return (
        <path
          d={`M ${cx} ${cy - h} L ${cx + h} ${cy} L ${cx} ${cy + h} L ${cx - h} ${cy} Z`}
          fill={color}
        />
      )
    case 'triangle-up':
      return (
        <path d={`M ${cx} ${cy - h} L ${cx + h} ${cy + h} L ${cx - h} ${cy + h} Z`} fill={color} />
      )
    case 'triangle-down':
      return (
        <path d={`M ${cx - h} ${cy - h} L ${cx + h} ${cy - h} L ${cx} ${cy + h} Z`} fill={color} />
      )
    case 'cross':
      return (
        <path
          d={`M ${cx - h} ${cy - h / 3} H ${cx - h / 3} V ${cy - h} H ${cx + h / 3} V ${cy - h / 3} H ${cx + h} V ${cy + h / 3} H ${cx + h / 3} V ${cy + h} H ${cx - h / 3} V ${cy + h / 3} H ${cx - h} Z`}
          fill={color}
        />
      )
    default:
      return <circle cx={cx} cy={cy} r={h} fill={color} />
  }
}

/** Shared execution-chart glyph geometry. Kept stable when studies add their own shapes. */
export function liveStrategyMarkerGlyph(
  marker: ChartMarker,
  cx: number,
  barHigh: number,
  barLow: number,
  priceScale: LinearScale,
): ReactNode {
  const detail = <title>{marker.detail}</title>
  if (marker.kind === 'buy') {
    const y = priceScale(barLow) + 14
    return (
      <g key={marker.id} data-testid={`live-chart-marker-${marker.id}`} data-kind="buy">
        <path
          d={`M ${cx} ${y - 9} L ${cx - 6} ${y + 3} L ${cx + 6} ${y + 3} Z`}
          fill={BULL_COLOR}
        />
        {detail}
      </g>
    )
  }
  if (marker.kind === 'sell') {
    const y = priceScale(barHigh) - 14
    return (
      <g key={marker.id} data-testid={`live-chart-marker-${marker.id}`} data-kind="sell">
        <path
          d={`M ${cx} ${y + 9} L ${cx - 6} ${y - 3} L ${cx + 6} ${y - 3} Z`}
          fill={BEAR_COLOR}
        />
        {detail}
      </g>
    )
  }
  if (marker.kind === 'close') {
    const y = priceScale(barHigh) - 14
    return (
      <g key={marker.id} data-testid={`live-chart-marker-${marker.id}`} data-kind="close">
        <rect x={cx - 5} y={y - 5} width={10} height={10} rx={2} fill="#e5e7eb" />
        {detail}
      </g>
    )
  }
  const y = marker.price != null ? priceScale(marker.price) : priceScale((barHigh + barLow) / 2)
  return (
    <g key={marker.id} data-testid={`live-chart-marker-${marker.id}`} data-kind="fill">
      <circle cx={cx} cy={y} r={3.5} fill="#f5f5f5" stroke="#0b1220" strokeWidth={1} />
      {detail}
    </g>
  )
}
