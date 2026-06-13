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

function getRsiCloudFill(color: string): string {
  if (color.startsWith('#')) {
    let hex = color
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    }
    return `${hex}0a` // ~4% opacity
  }
  return 'rgba(167, 139, 250, 0.04)'
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
    const color = config.color ?? '#a78bfa'
    const strokeWidth = config.strokeWidth ?? 1.2
    const showCloud = config.showCloud ?? true

    return (
      <g transform={`translate(${left}, 0)`}>
        <rect
          x={0}
          y={top}
          width={xScale.range()[1]}
          height={height}
          fill="rgba(7, 16, 28, 0.35)"
          stroke="rgba(111, 119, 133, 0.15)"
          shapeRendering="crispEdges"
        />
        {showCloud && (
          <rect
            x={0}
            y={Math.round(yScale(70))}
            width={xScale.range()[1]}
            height={Math.max(Math.round(yScale(30) - yScale(70)), 1)}
            fill={getRsiCloudFill(color)}
            stroke="none"
          />
        )}
        <line
          x1={0}
          x2={xScale.range()[1]}
          y1={Math.round(yScale(70))}
          y2={Math.round(yScale(70))}
          stroke="rgba(239, 83, 80, 0.35)"
          strokeDasharray="3 2"
          shapeRendering="crispEdges"
        />
        <line
          x1={0}
          x2={xScale.range()[1]}
          y1={Math.round(yScale(30))}
          y2={Math.round(yScale(30))}
          stroke="rgba(38, 166, 154, 0.35)"
          strokeDasharray="3 2"
          shapeRendering="crispEdges"
        />
        <path
          d={seriesPath(values, allBars, visibleSet, xScale, yScale)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
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
    const isNarrow = bw < 4
    const histBars = visibleBars.map((bar) => {
      const idx = allBars.findIndex((b) => b.timestamp === bar.timestamp)
      const val = idx >= 0 ? histogram[idx] : null
      if (val === null) return null
      const x = xScale(bar.timestamp) ?? 0
      const cx = Math.round(x + bw / 2)
      const y0 = Math.round(yScale(0))
      const y1 = Math.round(yScale(val))
      const rectY = Math.min(y0, y1)
      const rectH = Math.max(Math.abs(y1 - y0), 1)

      const width = isNarrow ? Math.max(Math.floor(bw), 1) : Math.max(Math.round(bw * 0.6), 1)
      const rectX = Math.floor(cx - width / 2)

      return {
        x: rectX,
        y: rectY,
        w: width,
        h: rectH,
        color: val >= 0 ? '#26a69a' : '#ef5350',
      }
    })

    const macdColor = config.macdColor ?? '#6eb5ff'
    const signalColor = config.signalColor ?? '#c9a227'

    return (
      <g transform={`translate(${left}, 0)`}>
        <rect
          x={0}
          y={top}
          width={xScale.range()[1]}
          height={height}
          fill="rgba(7, 16, 28, 0.35)"
          stroke="rgba(111, 119, 133, 0.15)"
          shapeRendering="crispEdges"
        />
        <line
          x1={0}
          x2={xScale.range()[1]}
          y1={Math.round(yScale(0))}
          y2={Math.round(yScale(0))}
          stroke="rgba(111, 119, 133, 0.2)"
          strokeDasharray="2 2"
          shapeRendering="crispEdges"
        />
        {histBars.map(
          (h, i) =>
            h && (
              <rect
                key={i}
                x={h.x}
                y={h.y}
                width={h.w}
                height={h.h}
                fill={h.color}
                fillOpacity={0.7}
                shapeRendering="crispEdges"
              />
            ),
        )}
        <path
          d={seriesPath(macdLine, allBars, visibleSet, xScale, yScale)}
          fill="none"
          stroke={macdColor}
          strokeWidth={1.2}
        />
        <path
          d={seriesPath(signal, allBars, visibleSet, xScale, yScale)}
          fill="none"
          stroke={signalColor}
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
