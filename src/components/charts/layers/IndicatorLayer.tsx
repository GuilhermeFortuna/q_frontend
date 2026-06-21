import { memo, useMemo } from 'react'

import { useIndicatorSeries } from '@/components/charts/hooks/useIndicatorSeries'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { IndicatorConfig, ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'
import {
  bandsAreaPath,
  linePath,
  visibleTimestampSet,
} from '@/components/charts/utils/indicatorPaths'
import type { OhlcvBar } from '@/types/api'

type IndicatorLayerProps = {
  allBars: OhlcvBar[]
  visibleBars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  indicators: IndicatorConfig[]
  left: number
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

function IndicatorLayerImpl({
  allBars,
  visibleBars,
  xScale,
  yScale,
  indicators,
  left,
}: IndicatorLayerProps) {
  const visibleSet = useMemo(
    () => visibleTimestampSet(visibleBars.map((bar) => bar.timestamp)),
    [visibleBars],
  )
  const series = useIndicatorSeries(allBars, indicators)

  const paths = useMemo(
    () =>
      series.map((entry) => {
        if (entry.kind === 'line') {
          const ind = entry.config
          if (ind.type === 'sma') {
            const color = ind.color ?? BRASS_COLOR
            const strokeWidth = ind.strokeWidth ?? 1.2
            const dash = getStrokeDasharray(ind.lineStyle ?? 'dashed')
            return (
              <path
                key="sma"
                d={linePath(entry.values, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
              />
            )
          }
          if (ind.type === 'ema') {
            const color = ind.color ?? '#6eb5ff'
            const strokeWidth = ind.strokeWidth ?? 1.2
            const dash = getStrokeDasharray(ind.lineStyle ?? 'solid')
            return (
              <path
                key="ema"
                d={linePath(entry.values, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
              />
            )
          }
          if (ind.type === 'wma') {
            const color = ind.color ?? '#f97316'
            const strokeWidth = ind.strokeWidth ?? 1.2
            const dash = getStrokeDasharray(ind.lineStyle ?? 'solid')
            return (
              <path
                key="wma"
                d={linePath(entry.values, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
              />
            )
          }
          if (ind.type === 'hma') {
            const color = ind.color ?? '#26a69a'
            const strokeWidth = ind.strokeWidth ?? 1.2
            const dash = getStrokeDasharray(ind.lineStyle ?? 'solid')
            return (
              <path
                key="hma"
                d={linePath(entry.values, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
              />
            )
          }
          if (ind.type === 'smma') {
            const color = ind.color ?? '#ef5350'
            const strokeWidth = ind.strokeWidth ?? 1.2
            const dash = getStrokeDasharray(ind.lineStyle ?? 'solid')
            return (
              <path
                key="smma"
                d={linePath(entry.values, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
              />
            )
          }
          return null
        }

        const ind = entry.config
        if (ind.type === 'bollinger') {
          const color = ind.color ?? '#c9a227'
          const strokeWidth = ind.strokeWidth ?? 1.0
          const showCloud = ind.showCloud ?? true
          return (
            <g key="bollinger">
              {showCloud && (
                <path
                  d={bandsAreaPath(entry.upper, entry.lower, allBars, visibleSet, xScale, yScale)}
                  fill={getCloudFill(color)}
                  stroke="none"
                />
              )}
              <path
                d={linePath(entry.upper, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={0.8}
              />
              <path
                d={linePath(entry.middle, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray="3 2"
                opacity={0.5}
              />
              <path
                d={linePath(entry.lower, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={0.8}
              />
            </g>
          )
        }

        if (ind.type === 'donchian') {
          const color = ind.color ?? '#6eb5ff'
          const strokeWidth = ind.strokeWidth ?? 1.0
          const showCloud = ind.showCloud ?? true
          return (
            <g key="donchian">
              {showCloud && (
                <path
                  d={bandsAreaPath(entry.upper, entry.lower, allBars, visibleSet, xScale, yScale)}
                  fill={getCloudFill(color)}
                  stroke="none"
                />
              )}
              <path
                d={linePath(entry.upper, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={0.8}
              />
              <path
                d={linePath(entry.middle, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray="2 2"
                opacity={0.4}
              />
              <path
                d={linePath(entry.lower, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={0.8}
              />
            </g>
          )
        }

        return null
      }),
    [allBars, series, visibleSet, xScale, yScale],
  )

  return <g transform={`translate(${left}, 0)`}>{paths}</g>
}

export const IndicatorLayer = memo(IndicatorLayerImpl)
