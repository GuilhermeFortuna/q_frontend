import { memo, useMemo } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { IndicatorConfig, ProcessedBar } from '@/components/charts/types/chart'
import { linePath, visibleTimestampSet } from '@/components/charts/utils/indicatorPaths'
import { macd, rsi } from '@/lib/indicators'
import type { MacdResult } from '@/lib/indicators'
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
  macdValues?: MacdResult | null
}

function getRsiCloudFill(color: string): string {
  if (color.startsWith('#')) {
    let hex = color
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    }
    return `${hex}0a`
  }
  return 'rgba(167, 139, 250, 0.04)'
}

function OscillatorPaneImpl({
  allBars,
  visibleBars,
  xScale,
  yScale,
  top,
  height,
  left,
  type,
  config,
  macdValues: macdValuesProp,
}: OscillatorPaneProps) {
  const visibleSet = useMemo(
    () => visibleTimestampSet(visibleBars.map((bar) => bar.timestamp)),
    [visibleBars],
  )

  const configKey = useMemo(() => JSON.stringify(config), [config])

  const rsiValues = useMemo(() => {
    if (type !== 'rsi' || config.type !== 'rsi' || !config.enabled) return null
    return rsi(allBars, config.period)
  }, [allBars, config, configKey, type])

  const macdValues = useMemo(() => {
    if (type !== 'macd' || config.type !== 'macd' || !config.enabled) return null
    if (macdValuesProp) return macdValuesProp
    return macd(allBars, config.fast, config.slow, config.signal)
  }, [allBars, config, configKey, macdValuesProp, type])

  const rsiPath = useMemo(() => {
    if (!rsiValues) return null
    return linePath(rsiValues, allBars, visibleSet, xScale, yScale)
  }, [allBars, rsiValues, visibleSet, xScale, yScale])

  const macdPaths = useMemo(() => {
    if (!macdValues) return null
    return {
      macd: linePath(macdValues.macd, allBars, visibleSet, xScale, yScale),
      signal: linePath(macdValues.signal, allBars, visibleSet, xScale, yScale),
    }
  }, [allBars, macdValues, visibleSet, xScale, yScale])

  const macdHistBars = useMemo(() => {
    if (!macdValues) return []
    const bw = xScale.bandwidth()
    const isNarrow = bw < 4

    return visibleBars
      .map((bar) => {
        const idx = allBars.findIndex((entry) => entry.timestamp === bar.timestamp)
        const val = idx >= 0 ? macdValues.histogram[idx] : null
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
          key: bar.timestamp,
          x: rectX,
          y: rectY,
          w: width,
          h: rectH,
          color: val >= 0 ? '#26a69a' : '#ef5350',
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  }, [allBars, macdValues, visibleBars, xScale, yScale])

  if (!config.enabled) return null

  if (type === 'rsi' && config.type === 'rsi' && rsiPath) {
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
        <path d={rsiPath} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <text x={4} y={top + 12} fill="#9ca3af" fontSize={9} fontFamily="monospace">
          RSI({config.period})
        </text>
      </g>
    )
  }

  if (type === 'macd' && config.type === 'macd' && macdPaths) {
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
        {macdHistBars.map((bar) => (
          <rect
            key={bar.key}
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={bar.h}
            fill={bar.color}
            fillOpacity={0.7}
            shapeRendering="crispEdges"
          />
        ))}
        <path d={macdPaths.macd} fill="none" stroke={macdColor} strokeWidth={1.2} />
        <path
          d={macdPaths.signal}
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

export const OscillatorPane = memo(OscillatorPaneImpl)
