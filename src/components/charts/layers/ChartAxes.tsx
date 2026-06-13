import { AxisBottom, AxisRight } from '@visx/axis'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import { isPaddingSlotKey } from '@/components/charts/types/chart'
import { formatTimeAxisLabel } from '@/lib/market/timeframes'

type ChartAxesProps = {
  xScale: BandScale
  priceScale: LinearScale
  volumeScale: LinearScale
  rsiScale?: LinearScale
  macdScale?: LinearScale
  layout: {
    priceTop: number
    priceHeight: number
    volumeTop: number
    volumeHeight: number
    rsiTop?: number
    rsiHeight?: number
    macdTop?: number
    macdHeight?: number
    innerWidth: number
  }
  timeframe: string
  left: number
  bottom: number
  height: number
}

const axisStyle = {
  tickLabelProps: () => ({
    fill: 'var(--color-silver-400, #9ca3af)',
    fontSize: 10,
    fontFamily: 'var(--font-mono, monospace)',
  }),
  stroke: 'rgba(111, 119, 133, 0.15)',
  tickStroke: 'rgba(111, 119, 133, 0.15)',
}

export function ChartAxes({
  xScale,
  priceScale,
  volumeScale,
  rsiScale,
  macdScale,
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
      {rsiScale && layout.rsiTop !== undefined && (
        <AxisRight
          left={left + layout.innerWidth}
          scale={rsiScale}
          numTicks={3}
          tickFormat={(v) => `${v}`}
          {...axisStyle}
        />
      )}
      {macdScale && layout.macdTop !== undefined && (
        <AxisRight
          left={left + layout.innerWidth}
          scale={macdScale}
          numTicks={3}
          tickFormat={() => ''}
          {...axisStyle}
        />
      )}
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
