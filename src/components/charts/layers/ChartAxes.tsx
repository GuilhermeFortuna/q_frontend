import { memo } from 'react'
import { AxisBottom, AxisRight } from '@visx/axis'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import { isPaddingSlotKey, type PaneLayout } from '@/components/charts/types/chart'
import { chartTheme } from '@/lib/charts/chartTheme'
import { formatTimeAxisLabel } from '@/lib/market/timeframes'
import { formatPrice } from '@/lib/market/priceFormat'

type ChartAxesProps = {
  xScale: BandScale
  priceScale: LinearScale
  volumeScale: LinearScale
  oscillatorScales: Array<{ key: string; scale: LinearScale }>
  layout: Pick<
    PaneLayout,
    | 'innerWidth'
    | 'innerHeight'
    | 'priceTop'
    | 'priceHeight'
    | 'volumeTop'
    | 'volumeHeight'
    | 'oscillators'
  >
  timeframe: string
  /** Decimal places for price ticks, from the instrument's precision. */
  priceDigits?: number
  /** Hides the volume value axis when the volume pane is turned off. */
  showVolume?: boolean
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

function ChartAxesImpl({
  xScale,
  priceScale,
  volumeScale,
  oscillatorScales,
  layout,
  timeframe,
  priceDigits = 2,
  showVolume = true,
  left,
  bottom,
  height,
}: ChartAxesProps) {
  const xTop = height - bottom

  return (
    <>
      <AxisRight
        left={left + layout.innerWidth}
        scale={priceScale}
        numTicks={6}
        tickFormat={(v) => formatPrice(Number(v), priceDigits)}
        {...axisStyle}
      />
      {showVolume && (
        <AxisRight
          left={left + layout.innerWidth}
          scale={volumeScale}
          numTicks={2}
          tickFormat={() => ''}
          {...axisStyle}
        />
      )}
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

export const ChartAxes = memo(ChartAxesImpl)
