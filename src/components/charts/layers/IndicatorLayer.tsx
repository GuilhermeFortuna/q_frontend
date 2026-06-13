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

function getStrokeDasharray(style?: 'solid' | 'dashed' | 'dotted'): string | undefined {
  if (style === 'dashed') return '5 3'
  if (style === 'dotted') return '2 3'
  return undefined
}

function getCloudFill(color: string): string {
  if (color.startsWith('#')) {
    let hex = color
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    }
    return `${hex}0f`
  }
  return 'rgba(201, 162, 39, 0.05)'
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
          const color = ind.color ?? BRASS_COLOR
          const strokeWidth = ind.strokeWidth ?? 1.2
          const dash = getStrokeDasharray(ind.lineStyle ?? 'dashed')
          return (
            <path
              key="sma"
              d={linePath(values, allBars, visibleSet, xScale, yScale)}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
            />
          )
        }

        if (ind.type === 'ema') {
          const values = ema(allBars, ind.period)
          const color = ind.color ?? '#6eb5ff'
          const strokeWidth = ind.strokeWidth ?? 1.2
          const dash = getStrokeDasharray(ind.lineStyle ?? 'solid')
          return (
            <path
              key="ema"
              d={linePath(values, allBars, visibleSet, xScale, yScale)}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
            />
          )
        }

        if (ind.type === 'bollinger') {
          const bands = bollingerBands(allBars, ind.period, ind.stdDev)
          const color = ind.color ?? '#c9a227'
          const strokeWidth = ind.strokeWidth ?? 1.0
          const showCloud = ind.showCloud ?? true
          return (
            <g key="bollinger">
              {showCloud && (
                <path
                  d={bandsAreaPath(bands.upper, bands.lower, allBars, visibleSet, xScale, yScale)}
                  fill={getCloudFill(color)}
                  stroke="none"
                />
              )}
              <path
                d={linePath(bands.upper, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={0.8}
              />
              <path
                d={linePath(bands.middle, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray="3 2"
                opacity={0.5}
              />
              <path
                d={linePath(bands.lower, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={0.8}
              />
            </g>
          )
        }

        return null
      })}
    </g>
  )
}
