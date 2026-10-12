import { AxisBottom, AxisRight } from '@visx/axis'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import { isPaddingSlotKey, type PaneLayout } from '@/components/charts/types/chart'
import { chartTheme } from '@/lib/charts/chartTheme'
import { formatTimeAxisLabel } from '@/lib/market/timeframes'

type ChartAxesProps = {
  xScale: BandScale
  priceScale: LinearScale
  volumeScale: LinearScale
  oscillatorScales: Array<{ key: string; scale: LinearScale }>
  layout: PaneLayout
  timeframe: string
  left: number
  bottom: number
  height: number
}

const axisStyle = {
  tickLabelProps: () => ({
    fill: chartTheme.axis.tick.fill,
    fontSize: chartTheme.axis.tick.fontSize,
    fontFamily: 'var(--font-mono, monospace)',
    fontVariantNumeric: chartTheme.axis.tick.fontVariantNumeric,
  }),
  stroke: chartTheme.axis.stroke,
  tickStroke: chartTheme.axis.stroke,
}

export function ChartAxes({
  xScale,
  priceScale,
  volumeScale,
  oscillatorScales,
  layout,
  timeframe,
  left,
  bottom,
  height,
}: ChartAxesProps) {
  const xTop = height - bottom

  return (
    <>
      <AxisRight left={left + layout.innerWidth} scale={priceScale} numTicks={6} {...axisStyle} />
      <AxisRight
        left={left + layout.innerWidth}
        scale={volumeScale}
        numTicks={2}
        tickFormat={() => ''}
        {...axisStyle}
      />
      {oscillatorScales.map((entry) => (
        <AxisRight
          key={entry.key}
          left={left + layout.innerWidth}
          scale={entry.scale}
          numTicks={3}
          tickFormat={(v) => `${v}`}
          {...axisStyle}
        />
      ))}
      <AxisBottom
        top={xTop}
        left={left}
        scale={xScale}
        tickFormat={(v) =>
          isPaddingSlotKey(String(v)) ? '' : formatTimeAxisLabel(String(v), timeframe)
        }
        numTicks={Math.min(8, xScale.domain().length)}
        {...axisStyle}
      />
    </>
  )
}
