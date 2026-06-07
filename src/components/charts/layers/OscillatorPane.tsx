import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { IndicatorConfig, ProcessedBar } from '@/components/charts/types/chart'
import { macd, rsi } from '@/lib/indicators'
import type { OhlcvBar } from '@/types/api'

type OscillatorPaneProps = {
  allBars: OhlcvBar[]
  visibleBars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  top: number
  height: number
  left: number
  type: 'rsi' | 'macd'
  config: IndicatorConfig
}

function seriesPath(
  values: (number | null)[],
  allBars: OhlcvBar[],
  visibleSet: Set<string>,
  xScale: BandScale,
  yScale: LinearScale,
): string {
  const bw = xScale.bandwidth()
  const parts: string[] = []
  let started = false
  for (let i = 0; i < allBars.length; i++) {
    const ts = allBars[i].timestamp
    if (!visibleSet.has(ts)) continue
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

export function OscillatorPane({
  allBars,
  visibleBars,
  xScale,
  yScale,
  top,
  height,
  left,
  type,
  config,
}: OscillatorPaneProps) {
  if (!config.enabled) return null

  const visibleSet = new Set(visibleBars.map((b) => b.timestamp))

  if (type === 'rsi' && config.type === 'rsi') {
    const values = rsi(allBars, config.period)
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
          y1={yScale(70)}
          y2={yScale(70)}
          stroke="rgba(255, 59, 48, 0.25)"
          strokeDasharray="2 2"
        />
        <line
          x1={0}
          x2={xScale.range()[1]}
          y1={yScale(30)}
          y2={yScale(30)}
          stroke="rgba(0, 192, 118, 0.25)"
          strokeDasharray="2 2"
        />
        <path
          d={seriesPath(values, allBars, visibleSet, xScale, yScale)}
          fill="none"
          stroke="#a78bfa"
          strokeWidth={1.2}
        />
        <text x={4} y={top + 12} fill="#9ca3af" fontSize={9} fontFamily="monospace">
          RSI({config.period})
        </text>
      </g>
    )
  }

  if (type === 'macd' && config.type === 'macd') {
    const {
      macd: macdLine,
      signal,
      histogram,
    } = macd(allBars, config.fast, config.slow, config.signal)
    const bw = xScale.bandwidth()
    const histBars = visibleBars.map((bar) => {
      const idx = allBars.findIndex((b) => b.timestamp === bar.timestamp)
      const val = idx >= 0 ? histogram[idx] : null
      if (val === null) return null
      const x = xScale(bar.timestamp) ?? 0
      const y0 = yScale(0)
      const y1 = yScale(val)
      return {
        x,
        y: Math.min(y0, y1),
        h: Math.abs(y1 - y0),
        color: val >= 0 ? '#00c076' : '#ff3b30',
      }
    })

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
        {histBars.map(
          (h, i) =>
            h && (
              <rect
                key={i}
                x={h.x + bw * 0.2}
                y={h.y}
                width={bw * 0.6}
                height={Math.max(h.h, 1)}
                fill={h.color}
                opacity={0.6}
              />
            ),
        )}
        <path
          d={seriesPath(macdLine, allBars, visibleSet, xScale, yScale)}
          fill="none"
          stroke="#6eb5ff"
          strokeWidth={1.2}
        />
        <path
          d={seriesPath(signal, allBars, visibleSet, xScale, yScale)}
          fill="none"
          stroke="#c9a227"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
        <text x={4} y={top + 12} fill="#9ca3af" fontSize={9} fontFamily="monospace">
          MACD
        </text>
      </g>
    )
  }

  return null
}
