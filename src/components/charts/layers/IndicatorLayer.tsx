import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { IndicatorConfig, ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'
import { bollingerBands, ema, sma } from '@/lib/indicators'
import type { OhlcvBar } from '@/types/api'

type IndicatorLayerProps = {
  allBars: OhlcvBar[]
  visibleBars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  indicators: IndicatorConfig[]
  left: number
}

function linePath(
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

function bandsAreaPath(
  upper: (number | null)[],
  lower: (number | null)[],
  allBars: OhlcvBar[],
  visibleTimestamps: Set<string>,
  xScale: BandScale,
  yScale: LinearScale,
): string {
  const bw = xScale.bandwidth()
  const upperPoints: string[] = []
  const lowerPoints: string[] = []

  for (let i = 0; i < allBars.length; i++) {
    const ts = allBars[i].timestamp
    if (!visibleTimestamps.has(ts)) continue
    const uVal = upper[i]
    const lVal = lower[i]
    if (uVal === null || lVal === null) continue

    const x = (xScale(ts) ?? 0) + bw / 2
    const yUpper = yScale(uVal)
    const yLower = yScale(lVal)

    upperPoints.push(`${x},${yUpper}`)
    lowerPoints.unshift(`${x},${yLower}`)
  }

  if (upperPoints.length === 0) return ''
  return `M ${upperPoints[0].replace(',', ' ')} ${upperPoints
    .slice(1)
    .map((p) => `L ${p.replace(',', ' ')}`)
    .join(' ')} L ${lowerPoints[0].replace(',', ' ')} ${lowerPoints
    .slice(1)
    .map((p) => `L ${p.replace(',', ' ')}`)
    .join(' ')} Z`
}

export function IndicatorLayer({
  allBars,
  visibleBars,
  xScale,
  yScale,
  indicators,
  left,
}: IndicatorLayerProps) {
  const visibleSet = new Set(visibleBars.map((b) => b.timestamp))

  return (
    <g transform={`translate(${left}, 0)`}>
      {indicators.map((ind) => {
        if (!ind.enabled) return null

        if (ind.type === 'sma') {
          const values = sma(allBars, ind.period)
          return (
            <path
              key="sma"
              d={linePath(values, allBars, visibleSet, xScale, yScale)}
              fill="none"
              stroke={BRASS_COLOR}
              strokeWidth={1.2}
              strokeDasharray="4 2"
            />
          )
        }

        if (ind.type === 'ema') {
          const values = ema(allBars, ind.period)
          return (
            <path
              key="ema"
              d={linePath(values, allBars, visibleSet, xScale, yScale)}
              fill="none"
              stroke="#6eb5ff"
              strokeWidth={1.2}
            />
          )
        }

        if (ind.type === 'bollinger') {
          const bands = bollingerBands(allBars, ind.period, ind.stdDev)
          return (
            <g key="bollinger">
              <path
                d={bandsAreaPath(bands.upper, bands.lower, allBars, visibleSet, xScale, yScale)}
                fill="rgba(201, 162, 39, 0.05)"
                stroke="none"
              />
              <path
                d={linePath(bands.upper, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke="rgba(201, 162, 39, 0.45)"
                strokeWidth={1}
              />
              <path
                d={linePath(bands.middle, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke="rgba(201, 162, 39, 0.3)"
                strokeWidth={1}
                strokeDasharray="3 2"
              />
              <path
                d={linePath(bands.lower, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke="rgba(201, 162, 39, 0.45)"
                strokeWidth={1}
              />
            </g>
          )
        }

        return null
      })}
    </g>
  )
}
