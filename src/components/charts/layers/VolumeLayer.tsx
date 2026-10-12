import { memo, useMemo } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import type { ProcessedBar } from '@/components/charts/types/chart'

type VolumeLayerProps = {
  visibleBars?: ProcessedBar[]
  /** @deprecated Use visibleBars */
  bars?: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  left: number
  volumeOpacity?: number
}

function VolumeLayerImpl({
  visibleBars,
  bars,
  xScale,
  yScale,
  left,
  volumeOpacity = 0.4,
}: VolumeLayerProps) {
  const resolvedBars = visibleBars ?? bars ?? []
  const bandwidth = xScale.bandwidth()
  const isNarrow = bandwidth < 4

  const volumeBars = useMemo(
    () =>
      resolvedBars.map((bar) => {
        const x = xScale(bar.timestamp) ?? 0
        const cx = Math.round(x + bandwidth / 2)
        const y = Math.round(yScale(bar.volume))
        const yZero = Math.round(yScale(0))
        const h = Math.max(yZero - y, 0)

        const width = isNarrow
          ? Math.max(Math.floor(bandwidth), 1)
          : Math.max(Math.round(bandwidth * 0.7), 1)
        const rectX = Math.floor(cx - width / 2)

        return {
          key: bar.timestamp,
          rectX,
          y,
          width,
          h,
          isBullish: bar.isBullish,
        }
      }),
    [resolvedBars, xScale, yScale, bandwidth, isNarrow],
  )

  return (
    <g transform={`translate(${left}, 0)`}>
      <g opacity={volumeOpacity}>
        {volumeBars.map((bar) => (
          <rect
            key={`vol-${bar.key}`}
            x={bar.rectX}
            y={bar.y}
            width={bar.width}
            height={bar.h}
            fill={bar.isBullish ? 'url(#volume-bull-gradient)' : 'url(#volume-bear-gradient)'}
            rx={1.5}
            ry={1.5}
            shapeRendering="geometricPrecision"
          />
        ))}
      </g>
    </g>
  )
}

export const VolumeLayer = memo(VolumeLayerImpl)
