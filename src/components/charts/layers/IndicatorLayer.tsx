import { memo, useMemo, type ReactNode } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import type { IndicatorRenderModel } from '@/lib/market/buildIndicatorRenderModel'
import type { ProcessedBar } from '@/components/charts/types/chart'
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
  model: IndicatorRenderModel
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
  model,
  left,
}: IndicatorLayerProps) {
  const visibleSet = useMemo(
    () => visibleTimestampSet(visibleBars.map((bar) => bar.timestamp)),
    [visibleBars],
  )

  const paths = useMemo(() => {
    const elements: ReactNode[] = []

    for (const entry of model.priceLines) {
      const color = entry.config.style?.color ?? BRASS_COLOR
      const strokeWidth = entry.config.style?.strokeWidth ?? 1.2
      const dash = getStrokeDasharray(entry.config.style?.lineStyle ?? 'solid')
      elements.push(
        <path
          key={entry.instanceKey}
          data-testid={`market-indicator-line-${entry.catalogId}`}
          d={linePath(entry.values, allBars, visibleSet, xScale, yScale)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
        />,
      )
    }

    for (const entry of model.priceBands) {
      const color = entry.config.style?.color ?? '#c9a227'
      const strokeWidth = entry.config.style?.strokeWidth ?? 1.0
      const showCloud = entry.config.style?.showCloud ?? true
      elements.push(
        <g key={entry.instanceKey} data-testid={`market-indicator-bands-${entry.catalogId}`}>
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
        </g>,
      )
    }

    return elements
  }, [allBars, model.priceBands, model.priceLines, visibleSet, xScale, yScale])

  return <g transform={`translate(${left}, 0)`}>{paths}</g>
}

export const IndicatorLayer = memo(IndicatorLayerImpl)
