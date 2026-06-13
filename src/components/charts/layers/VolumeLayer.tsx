import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { ProcessedBar } from '@/components/charts/types/chart'

type VolumeLayerProps = {
  bars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  left: number
}

export function VolumeLayer({ bars, xScale, yScale, left }: VolumeLayerProps) {
  const bandwidth = xScale.bandwidth()
  const isNarrow = bandwidth < 4

  return (
    <g transform={`translate(${left}, 0)`} opacity={0.4}>
      {bars.map((bar) => {
        const x = xScale(bar.timestamp) ?? 0
        const cx = Math.round(x + bandwidth / 2)
        const y = Math.round(yScale(bar.volume))
        const yZero = Math.round(yScale(0))
        const h = Math.max(yZero - y, 0)

        const width = isNarrow
          ? Math.max(Math.floor(bandwidth), 1)
          : Math.max(Math.round(bandwidth * 0.7), 1)
        const rectX = isNarrow ? Math.floor(cx - width / 2) : Math.floor(cx - width / 2)

        return (
          <rect
            key={`vol-${bar.timestamp}`}
            x={rectX}
            y={y}
            width={width}
            height={h}
            fill={bar.isBullish ? 'url(#volume-bull-gradient)' : 'url(#volume-bear-gradient)'}
            rx={1.5}
            ry={1.5}
            shapeRendering="geometricPrecision"
          />
        )
      })}
    </g>
  )
}
