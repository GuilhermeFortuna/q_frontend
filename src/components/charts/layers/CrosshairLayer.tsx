import { memo } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { PaneLayout, ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'
import { chartTheme } from '@/lib/charts/chartTheme'
import { formatCrosshairLabel } from '@/lib/market/timeframes'
import { formatPrice } from '@/lib/market/priceFormat'
import { barCenterX } from '@/components/charts/hooks/useChartScales'

const PRICE_LABEL_HEIGHT = 18
const PRICE_LABEL_CHAR_WIDTH = 6.4
const PRICE_LABEL_PADDING = 10

type CrosshairLayerProps = {
  activeBar: ProcessedBar | null
  xScale: BandScale
  priceScale: LinearScale
  layout: Pick<PaneLayout, 'priceTop' | 'priceHeight' | 'innerWidth' | 'stack'>
  timeframe: string
  left: number
  /** Width of the whole SVG, used to keep the price label inside the chart. */
  width: number
  /** Pointer y in SVG coordinates, or null when the pointer is outside the chart. */
  mouseY?: number | null
  /** Price under the pointer (after magnet snapping); the label and line sit at this price. */
  price: number | null
  digits: number
}

function CrosshairLayerImpl({
  activeBar,
  xScale,
  priceScale,
  layout,
  timeframe,
  left,
  width,
  mouseY,
  price,
  digits,
}: CrosshairLayerProps) {
  if (!activeBar) return null

  const cx = barCenterX(xScale, activeBar.timestamp) + left
  const barX = (xScale(activeBar.timestamp) ?? 0) + left
  const bandwidth = xScale.bandwidth()
  const priceTop = layout.priceTop
  const priceBottom = layout.priceTop + layout.priceHeight
  const spanBottom = layout.stack.reduce(
    (bottom, slot) => Math.max(bottom, slot.top + slot.height),
    priceBottom,
  )
  const timeLabel = formatCrosshairLabel(activeBar.timestamp, timeframe)
  const timeLabelWidth = Math.max(72, timeLabel.length * 5.6 + 12)

  // The horizontal line and price label belong to the price pane only; other panes read out separately.
  const inPricePane = mouseY != null && mouseY >= priceTop && mouseY <= priceBottom
  const priceY = inPricePane && price != null ? priceScale(price) : null
  const priceLabel = price != null ? formatPrice(price, digits) : ''
  const labelWidth = priceLabel.length * PRICE_LABEL_CHAR_WIDTH + PRICE_LABEL_PADDING
  const labelX = Math.min(left + layout.innerWidth + 2, width - labelWidth - 1)
  const labelY =
    priceY === null
      ? 0
      : Math.min(
          Math.max(priceY - PRICE_LABEL_HEIGHT / 2, priceTop),
          priceBottom - PRICE_LABEL_HEIGHT,
        )

  return (
    <g pointerEvents="none">
      <rect
        x={Math.floor(barX)}
        y={priceTop}
        width={Math.max(Math.ceil(bandwidth), 1)}
        height={Math.max(layout.priceHeight, 0)}
        fill="rgba(255, 255, 255, 0.05)"
        shapeRendering="crispEdges"
      />
      <line
        x1={cx}
        x2={cx}
        y1={priceTop}
        y2={spanBottom}
        stroke={chartTheme.crosshair.stroke}
        strokeDasharray={chartTheme.crosshair.strokeDasharray}
      />
      {priceY !== null && (
        <>
          <line
            data-testid="crosshair-price-line"
            x1={left}
            x2={left + layout.innerWidth}
            y1={priceY}
            y2={priceY}
            stroke={chartTheme.crosshair.stroke}
            strokeDasharray={chartTheme.crosshair.strokeDasharray}
          />
          <rect
            x={labelX}
            y={labelY}
            width={labelWidth}
            height={PRICE_LABEL_HEIGHT}
            rx={3}
            fill={BRASS_COLOR}
          />
          <text
            data-testid="crosshair-price-label"
            x={labelX + 4}
            y={labelY + 13}
            fill="#07101c"
            fontSize={10}
            fontFamily="monospace"
            fontWeight="bold"
          >
            {priceLabel}
          </text>
        </>
      )}
      <rect
        x={cx - timeLabelWidth / 2}
        y={priceBottom + 4}
        width={timeLabelWidth}
        height={16}
        rx={3}
        fill="rgba(7, 16, 28, 0.9)"
        stroke="rgba(201, 162, 39, 0.4)"
      />
      <text
        x={cx}
        y={priceBottom + 15}
        textAnchor="middle"
        fill="#d1d5db"
        fontSize={9}
        fontFamily="monospace"
      >
        {timeLabel}
      </text>
    </g>
  )
}

export const CrosshairLayer = memo(CrosshairLayerImpl)
