import { memo } from 'react'
import { GridColumns, GridRows } from '@visx/grid'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import { GRID_COLOR } from '@/components/charts/types/chart'

type GridLayerProps = {
  xScale: BandScale
  yScale: LinearScale
  width: number
  height: number
  top: number
  left: number
}

function GridLayerImpl({ xScale, yScale, width, height, top, left }: GridLayerProps) {
  return (
    <g transform={`translate(${left}, 0)`}>
      <GridRows scale={yScale} width={width} stroke={GRID_COLOR} numTicks={6} />
      <GridColumns scale={xScale} height={height} top={top} stroke={GRID_COLOR} />
    </g>
  )
}

export const GridLayer = memo(GridLayerImpl)
