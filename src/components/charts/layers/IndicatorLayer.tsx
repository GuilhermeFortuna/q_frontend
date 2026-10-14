import { memo, useMemo, type ReactNode } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import type { IndicatorRenderModel } from '@/lib/market/buildIndicatorRenderModel'
import type { ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'
import {
  bandsAreaPath,
  linePath,
  pairedFillPath,
  stepPath,
  visibleTimestampSet,
} from '@/components/charts/utils/indicatorPaths'
import type { OhlcvBar } from '@/types/api'
import { studyMarkerShape, studyMarkerY } from '@/components/charts/layers/MarkerGlyph'

type IndicatorLayerProps = {
  allBars: OhlcvBar[]
  visibleBars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  model: IndicatorRenderModel
  left: number
  phase?: 'all' | 'fills' | 'overlays'
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
  phase = 'all',
}: IndicatorLayerProps) {
  const visibleSet = useMemo(
    () => visibleTimestampSet(visibleBars.map((bar) => bar.timestamp)),
    [visibleBars],
  )

  const paths = useMemo(() => {
    const elements: ReactNode[] = []

    if (phase !== 'overlays')
      for (const entry of model.priceLines) {
        if (!entry.fillValues) continue
        const fillPath = pairedFillPath(
          entry.values,
          entry.fillValues,
          entry.kind === 'step' ? 'step' : 'line',
          entry.fillKind === 'step' ? 'step' : 'line',
          allBars,
          visibleSet,
          xScale,
          yScale,
        )
        if (fillPath)
          elements.push(
            <path
              key={`${entry.instanceKey}-fill`}
              data-testid={`market-study-fill-${entry.outputKey}`}
              d={fillPath}
              fill={entry.config.style?.color ?? BRASS_COLOR}
              fillOpacity={entry.fillOpacity ?? 0.15}
              stroke="none"
            />,
          )
      }

    if (phase !== 'fills')
      for (const entry of model.priceLines) {
        if (entry.kind === 'histogram') continue
        if (entry.kind === 'markers') {
          visibleBars.forEach((visibleBar) => {
            const value = entry.values[visibleBar.index]
            if (
              value == null ||
              ((entry.position === 'above-bar' || entry.position === 'below-bar') && value === 0)
            )
              return
            const x = xScale(visibleBar.timestamp)
            if (x == null) return
            const y = studyMarkerY(entry.position, value, visibleBar, entry.size ?? 8, yScale)
            elements.push(
              <g
                key={`${entry.instanceKey}-${visibleBar.timestamp}`}
                data-testid={`market-study-marker-${entry.outputKey}`}
              >
                <title>{`${entry.studyName ?? ''} · ${entry.seriesLabel ?? entry.label}: ${value}`}</title>
                {studyMarkerShape(
                  entry.shape ?? 'circle',
                  x + xScale.bandwidth() / 2,
                  y,
                  entry.size ?? 8,
                  entry.config.style?.color ?? BRASS_COLOR,
                )}
              </g>,
            )
          })
          continue
        }
        const color = entry.config.style?.color ?? BRASS_COLOR
        const strokeWidth = entry.config.style?.strokeWidth ?? 1.2
        const dash = getStrokeDasharray(entry.config.style?.lineStyle ?? 'solid')
        elements.push(
          <path
            key={entry.instanceKey}
            data-testid={`market-indicator-line-${entry.catalogId}`}
            d={
              entry.kind === 'step'
                ? stepPath(entry.values, allBars, visibleSet, xScale, yScale)
                : linePath(entry.values, allBars, visibleSet, xScale, yScale)
            }
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />,
        )
      }

    if (phase !== 'fills')
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
            {entry.middle && (
              <path
                d={linePath(entry.middle, allBars, visibleSet, xScale, yScale)}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray="3 2"
                opacity={0.5}
              />
            )}
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
  }, [allBars, model.priceBands, model.priceLines, visibleBars, phase, visibleSet, xScale, yScale])

  return <g transform={`translate(${left}, 0)`}>{paths}</g>
}

export const IndicatorLayer = memo(IndicatorLayerImpl)
