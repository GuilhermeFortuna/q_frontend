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

  return (
    <g transform={`translate(${left}, 0)`} opacity={0.35}>
      {bars.map((bar) => {
        const x = xScale(bar.timestamp) ?? 0
        const y = yScale(bar.volume)
        const h = yScale(0) - y
        return (
          <rect
            key={`vol-${bar.timestamp}`}
            x={x + bandwidth * 0.15}
            y={y}
            width={bandwidth * 0.7}
            height={Math.max(h, 0)}
            fill={bar.color}
          />
        )
      })}
    </g>
  )
}
