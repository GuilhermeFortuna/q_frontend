import { memo } from 'react'

import type { LinearScale } from '@/components/charts/types/scales'
import type { ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'
import { chartTheme } from '@/lib/charts/chartTheme'
import type { OscillatorRenderGroup } from '@/lib/market/buildIndicatorRenderModel'
import { formatIndicatorValue } from '@/lib/market/format'

export type OscillatorHoverPane = {
  key: string
  top: number
  height: number
  scale: LinearScale
  group: OscillatorRenderGroup
}

type OscillatorHoverLayerProps = {
  bar: ProcessedBar | null
  mouseY: number | null
  panes: OscillatorHoverPane[]
  left: number
  innerWidth: number
}

function OscillatorHoverLayerImpl({
  bar,
  mouseY,
  panes,
  left,
  innerWidth,
}: OscillatorHoverLayerProps) {
  if (!bar || mouseY == null) return null
  const pane = panes.find((item) => mouseY >= item.top && mouseY <= item.top + item.height)
  if (!pane) return null

  const readout = pane.group.outputs.flatMap((output) => {
    if (output.kind === 'markers' || output.unavailableReason) return []
    const value = output.values[bar.index]
    if (value == null) return []
    return [
      {
        label: output.seriesLabel ?? output.label,
        color: output.color ?? chartTheme.series.muted,
        value: formatIndicatorValue(value),
      },
    ]
  })

  const axisValue = formatIndicatorValue(pane.scale.invert(mouseY))
  const axisX = left + innerWidth

  return (
    <g pointerEvents="none" data-testid="oscillator-hover">
      <line
        x1={left}
        x2={axisX}
        y1={mouseY}
        y2={mouseY}
        stroke={chartTheme.crosshair.stroke}
        strokeDasharray={chartTheme.crosshair.strokeDasharray}
      />
      <rect x={axisX + 2} y={mouseY - 9} width={58} height={18} rx={3} fill={BRASS_COLOR} />
      <text
        x={axisX + 6}
        y={mouseY + 4}
        fill="#07101c"
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {axisValue}
      </text>
      <text
        x={axisX - 6}
        y={pane.top + 12}
        textAnchor="end"
        fontSize={9}
        fontFamily="monospace"
        data-testid="oscillator-hover-readout"
      >
        {readout.map((entry, index) => (
          <tspan key={`${entry.label}-${index}`} fill={entry.color}>
            {index > 0 ? '   ' : ''}
            {`${entry.label} ${entry.value}`}
          </tspan>
        ))}
      </text>
    </g>
  )
}

export const OscillatorHoverLayer = memo(OscillatorHoverLayerImpl)
