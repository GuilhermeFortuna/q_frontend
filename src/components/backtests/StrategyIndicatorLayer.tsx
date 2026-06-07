import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { ProcessedBar } from '@/components/charts/types/chart'
import type { ChartIndicatorSeries } from '@/types/backtesting'
import type { OhlcvBar } from '@/types/api'

type StrategyIndicatorLayerProps = {
  allBars: OhlcvBar[]
  visibleBars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  indicators: ChartIndicatorSeries[]
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

  for (let i = 0; i < allBars.length; i += 1) {
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

export function StrategyIndicatorLayer({
  allBars,
  visibleBars,
  xScale,
  yScale,
  indicators,
  left,
}: StrategyIndicatorLayerProps) {
  const visibleSet = new Set(visibleBars.map((b) => b.timestamp))
  const priceIndicators = indicators.filter((ind) => ind.pane === 'price')

  return (
    <g transform={`translate(${left}, 0)`}>
      {priceIndicators.map((ind) => (
        <path
          key={ind.key}
          d={linePath(ind.values, allBars, visibleSet, xScale, yScale)}
          fill="none"
          stroke={ind.color ?? '#c9a227'}
          strokeWidth={1.2}
          strokeDasharray={ind.key.includes('long') ? undefined : '4 2'}
        />
      ))}
    </g>
  )
}

export function StrategyOscillatorLayer({
  allBars,
  visibleBars,
  xScale,
  yScale,
  indicators,
  top,
  height,
  left,
}: StrategyIndicatorLayerProps & { top: number; height: number }) {
  const visibleSet = new Set(visibleBars.map((b) => b.timestamp))
  const oscillatorIndicators = indicators.filter((ind) => ind.pane === 'oscillator')

  if (oscillatorIndicators.length === 0) return null

  return (
    <g transform={`translate(${left}, 0)`}>
      <rect
        x={0}
        y={top}
        width={xScale.range()[1]}
        height={height}
        fill="rgba(7, 16, 28, 0.35)"
        stroke="rgba(111, 119, 133, 0.15)"
      />
      <line
        x1={0}
        x2={xScale.range()[1]}
        y1={yScale(0)}
        y2={yScale(0)}
        stroke="rgba(111, 119, 133, 0.35)"
        strokeDasharray="2 2"
      />
      {oscillatorIndicators.map((ind) => (
        <g key={ind.key}>
          <path
            d={linePath(ind.values, allBars, visibleSet, xScale, yScale)}
            fill="none"
            stroke={ind.color ?? '#c9a227'}
            strokeWidth={1.2}
          />
          <text x={4} y={top + 12} fill="#9ca3af" fontSize={9} fontFamily="monospace">
            {ind.label}
          </text>
        </g>
      ))}
    </g>
  )
}
