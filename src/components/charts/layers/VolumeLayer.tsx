import { memo, useMemo } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { IndicatorConfig, ProcessedBar } from '@/components/charts/types/chart'
import { linePath, visibleTimestampSet } from '@/components/charts/utils/indicatorPaths'
import { volumeSma } from '@/lib/indicators/sma'
import type { OhlcvBar } from '@/types/api'

type VolumeLayerProps = {
  visibleBars?: ProcessedBar[]
  /** @deprecated Use visibleBars */
  bars?: ProcessedBar[]
  allBars?: OhlcvBar[]
  xScale: BandScale
  yScale: LinearScale
  left: number
  indicators?: IndicatorConfig[]
  volumeOpacity?: number
}

function VolumeLayerImpl({
  visibleBars,
  bars,
  allBars = [],
  xScale,
  yScale,
  left,
  indicators = [],
  volumeOpacity = 0.4,
}: VolumeLayerProps) {
  const resolvedBars = visibleBars ?? bars ?? []
  const bandwidth = xScale.bandwidth()
  const isNarrow = bandwidth < 4
  const visibleSet = useMemo(
    () => visibleTimestampSet(resolvedBars.map((bar) => bar.timestamp)),
    [resolvedBars],
  )

  const volMa = useMemo(
    () =>
      indicators.find(
        (ind): ind is Extract<IndicatorConfig, { type: 'volumeMa' }> =>
          ind.type === 'volumeMa' && ind.enabled,
      ),
    [indicators],
  )

  const volMaConfigKey = useMemo(() => (volMa ? JSON.stringify(volMa) : ''), [volMa])

  const volMaValues = useMemo(() => {
    if (!volMa || allBars.length === 0) return null
    return volumeSma(allBars, volMa.period)
  }, [allBars, volMa, volMaConfigKey])

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

  const volMaPath = useMemo(() => {
    if (!volMa || !volMaValues) return null
    return linePath(volMaValues, allBars, visibleSet, xScale, yScale)
  }, [allBars, volMa, volMaValues, visibleSet, xScale, yScale])

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

      {volMa && volMaPath ? (
        <path
          d={volMaPath}
          fill="none"
          stroke={volMa.color ?? '#a78bfa'}
          strokeWidth={volMa.strokeWidth ?? 1.2}
          strokeDasharray={
            volMa.lineStyle === 'dashed' ? '5 3' : volMa.lineStyle === 'dotted' ? '2 3' : undefined
          }
        />
      ) : null}
    </g>
  )
}

export const VolumeLayer = memo(VolumeLayerImpl)
