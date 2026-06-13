import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { IndicatorConfig, ProcessedBar } from '@/components/charts/types/chart'
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

function volumeLinePath(
  values: (number | null)[],
  allBars: OhlcvBar[],
  visibleTimestamps: Set<string>,
  xScale: BandScale,
  yScale: LinearScale,
): string {
  const bw = xScale.bandwidth()
  const parts: string[] = []
  let started = false

  for (let i = 0; i < allBars.length; i++) {
    const ts = allBars[i].timestamp
    if (!visibleTimestamps.has(ts)) continue
    const val = values[i]
    if (val === null) {
      started = false
      continue
    }
    const x = (xScale(ts) ?? 0) + bw / 2
    const y = yScale(val)
    parts.push(`${started ? 'L' : 'M'} ${x} ${y}`)
    started = true
  }

  return parts.join(' ')
}

export function VolumeLayer({
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
  const visibleSet = new Set(resolvedBars.map((b) => b.timestamp))

  const volMa = indicators.find(
    (ind): ind is Extract<IndicatorConfig, { type: 'volumeMa' }> =>
      ind.type === 'volumeMa' && ind.enabled,
  )
  const volMaValues = volMa && allBars.length > 0 ? volumeSma(allBars, volMa.period) : null

  return (
    <g transform={`translate(${left}, 0)`}>
      <g opacity={volumeOpacity}>
        {resolvedBars.map((bar) => {
          const x = xScale(bar.timestamp) ?? 0
          const cx = Math.round(x + bandwidth / 2)
          const y = Math.round(yScale(bar.volume))
          const yZero = Math.round(yScale(0))
          const h = Math.max(yZero - y, 0)

          const width = isNarrow
            ? Math.max(Math.floor(bandwidth), 1)
            : Math.max(Math.round(bandwidth * 0.7), 1)
          const rectX = Math.floor(cx - width / 2)

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

      {volMa && volMaValues && (
        <path
          d={volumeLinePath(volMaValues, allBars, visibleSet, xScale, yScale)}
          fill="none"
          stroke={volMa.color ?? '#a78bfa'}
          strokeWidth={volMa.strokeWidth ?? 1.2}
          strokeDasharray={
            volMa.lineStyle === 'dashed' ? '5 3' : volMa.lineStyle === 'dotted' ? '2 3' : undefined
          }
        />
      )}
    </g>
  )
}
