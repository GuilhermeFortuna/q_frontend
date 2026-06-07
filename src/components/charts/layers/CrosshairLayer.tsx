import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'
import { formatTimeAxisLabel } from '@/lib/market/timeframes'
import { barCenterX } from '@/components/charts/hooks/useChartScales'

type CrosshairLayerProps = {
  activeBar: ProcessedBar | null
  xScale: BandScale
  priceScale: LinearScale
  layout: { priceTop: number; priceHeight: number; innerWidth: number }
  timeframe: string
  left: number
  mouseY?: number | null
}

export function CrosshairLayer({
  activeBar,
  xScale,
  priceScale,
  layout,
  timeframe,
  left,
  mouseY,
}: CrosshairLayerProps) {
  if (!activeBar) return null

  const cx = barCenterX(xScale, activeBar.timestamp) + left
  const priceY = mouseY ?? priceScale(activeBar.close)

  return (
    <g pointerEvents="none">
      <line
        x1={cx}
        x2={cx}
        y1={layout.priceTop}
        y2={layout.priceTop + layout.priceHeight}
        stroke="rgba(201, 162, 39, 0.45)"
        strokeDasharray="4 3"
      />
      <line
        x1={left}
        x2={left + layout.innerWidth}
        y1={priceY}
        y2={priceY}
        stroke="rgba(201, 162, 39, 0.35)"
        strokeDasharray="4 3"
      />
      <rect
        x={left + layout.innerWidth + 2}
        y={priceY - 10}
        width={58}
        height={18}
        rx={3}
        fill={BRASS_COLOR}
      />
      <text
        x={left + layout.innerWidth + 6}
        y={priceY + 4}
        fill="#07101c"
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {activeBar.close.toFixed(2)}
      </text>
      <rect
        x={cx - 36}
        y={layout.priceTop + layout.priceHeight + 4}
        width={72}
        height={16}
        rx={3}
        fill="rgba(7, 16, 28, 0.9)"
        stroke="rgba(201, 162, 39, 0.4)"
      />
      <text
        x={cx}
        y={layout.priceTop + layout.priceHeight + 15}
        textAnchor="middle"
        fill="#d1d5db"
        fontSize={9}
        fontFamily="monospace"
      >
        {formatTimeAxisLabel(activeBar.timestamp, timeframe)}
      </text>
    </g>
  )
}
