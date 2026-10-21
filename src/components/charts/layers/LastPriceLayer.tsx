import { memo } from 'react'

import type { LinearScale } from '@/components/charts/types/scales'

import type { PaneLayout } from '@/components/charts/types/chart'
import { BEAR_COLOR, BULL_COLOR } from '@/components/charts/types/chart'
import { formatPrice } from '@/lib/market/priceFormat'

const LABEL_HEIGHT = 18
const LABEL_CHAR_WIDTH = 6.4
const LABEL_PADDING = 10

type LastPriceLayerProps = {
  /** Close of the latest loaded bar, or null when no bars are loaded. */
  price: number | null
  /** Whether the latest bar closed up (`close >= open`), which colours the line and label. */
  isBullish: boolean
  priceScale: LinearScale
  layout: Pick<PaneLayout, 'priceTop' | 'priceHeight' | 'innerWidth'>
  left: number
  width: number
  digits: number
}

/**
 * A dashed line at the latest close across the price pane. When the close lies outside the
 * visible range the line and its axis label pin to the nearest edge with an arrow.
 */
function LastPriceLayerImpl({
  price,
  isBullish,
  priceScale,
  layout,
  left,
  width,
  digits,
}: LastPriceLayerProps) {
  if (price === null || !Number.isFinite(price)) return null

  const top = layout.priceTop
  const bottom = layout.priceTop + layout.priceHeight
  const rawY = priceScale(price)
  const isAbove = rawY < top
  const isBelow = rawY > bottom
  const y = Math.min(Math.max(rawY, top), bottom)
  const color = isBullish ? BULL_COLOR : BEAR_COLOR
  const arrow = isAbove ? '▲ ' : isBelow ? '▼ ' : ''
  const label = `${arrow}${formatPrice(price, digits)}`
  const labelWidth = label.length * LABEL_CHAR_WIDTH + LABEL_PADDING
  const labelX = Math.min(left + layout.innerWidth + 2, width - labelWidth - 1)
  const labelY = Math.min(Math.max(y - LABEL_HEIGHT / 2, top), bottom - LABEL_HEIGHT)

  return (
    <g pointerEvents="none" data-testid="last-price">
      {!isAbove && !isBelow && (
        <line
          x1={left}
          x2={left + layout.innerWidth}
          y1={y}
          y2={y}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.9}
        />
      )}
      <rect x={labelX} y={labelY} width={labelWidth} height={LABEL_HEIGHT} rx={3} fill={color} />
      <text
        x={labelX + 4}
        y={labelY + 13}
        fill="#07101c"
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {label}
      </text>
    </g>
  )
}

export const LastPriceLayer = memo(LastPriceLayerImpl)
