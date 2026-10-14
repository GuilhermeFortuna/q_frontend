import { memo, useMemo } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'
import type { OscillatorRenderGroup } from '@/lib/market/buildIndicatorRenderModel'
import type { ProcessedBar } from '@/components/charts/types/chart'
import { linePath, visibleTimestampSet } from '@/components/charts/utils/indicatorPaths'
import type { OhlcvBar } from '@/types/api'
import { studyMarkerShape } from '@/components/charts/layers/MarkerGlyph'

function stepPath(
  values: (number | null)[],
  bars: OhlcvBar[],
  visible: Set<string>,
  xScale: BandScale,
  yScale: LinearScale,
) {
  let d = ''
  let prev = false
  bars.forEach((bar, i) => {
    const value = visible.has(bar.timestamp) ? values[i] : null
    if (value == null) {
      prev = false
      return
    }
    const x = (xScale(bar.timestamp) ?? 0) + xScale.bandwidth() / 2
    const y = yScale(value)
    d += prev ? ` H ${x} V ${y}` : ` M ${x} ${y}`
    prev = true
  })
  return d
}

type OscillatorPaneProps = {
  allBars: OhlcvBar[]
  visibleBars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  top: number
  height: number
  left: number
  group: OscillatorRenderGroup
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
  group,
}: OscillatorPaneProps) {
  const visibleSet = useMemo(
    () => visibleTimestampSet(visibleBars.map((bar) => bar.timestamp)),
    [visibleBars],
  )

  const unavailable = group.outputs.find((output) => output.unavailableReason)?.unavailableReason

  const isHistogram = (output: (typeof group.outputs)[number]) =>
    output.kind === 'histogram' || (group.catalogId === 'macd' && output.outputKey === 'histogram')
  const lineOutputs = group.outputs.filter(
    (output) => !isHistogram(output) && output.kind !== 'markers',
  )
  const markerOutputs = group.outputs.filter((output) => output.kind === 'markers')
  const histogram = group.outputs.find(isHistogram)

  const histBars = useMemo(() => {
    if (!histogram) return []
    const bw = xScale.bandwidth()
    const isNarrow = bw < 4
    return visibleBars
      .map((bar) => {
        const val = histogram.values[bar.index] ?? null
        if (val === null) return null
        const x = xScale(bar.timestamp) ?? 0
        const cx = Math.round(x + bw / 2)
        const baseline = histogram.baseline ?? 0
        const y0 = Math.round(yScale(baseline))
        const y1 = Math.round(yScale(val))
        const rectY = Math.min(y0, y1)
        const rectH = Math.max(Math.abs(y1 - y0), 1)
        const width = isNarrow ? Math.max(Math.floor(bw), 1) : Math.max(Math.round(bw * 0.6), 1)
        return {
          key: bar.timestamp,
          x: Math.floor(cx - width / 2),
          y: rectY,
          w: width,
          h: rectH,
          color:
            val >= baseline
              ? (histogram.color ?? '#26a69a')
              : (histogram.negativeColor ?? histogram.color ?? '#ef5350'),
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  }, [histogram, visibleBars, xScale, yScale])

  const primaryColor = group.config.style?.color ?? '#a78bfa'

  return (
    <g transform={`translate(${left}, 0)`} data-testid={`market-oscillator-${group.catalogId}`}>
      <rect
        x={0}
        y={top}
        width={xScale.range()[1]}
        height={height}
        fill="rgba(7, 16, 28, 0.35)"
        stroke="rgba(111, 119, 133, 0.15)"
        shapeRendering="crispEdges"
      />

      {unavailable ? (
        <text x={8} y={top + height / 2} fill="#f87171" fontSize={10} fontFamily="monospace">
          {unavailable}
        </text>
      ) : (
        <>
          {group.catalogId === 'rsi' && group.config.style?.showCloud !== false && (
            <rect
              x={0}
              y={Math.round(yScale(70))}
              width={xScale.range()[1]}
              height={Math.max(Math.round(yScale(30) - yScale(70)), 1)}
              fill={getRsiCloudFill(primaryColor)}
              stroke="none"
            />
          )}
          {group.catalogId === 'rsi' && (
            <>
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
            </>
          )}

          {group.catalogId === 'macd' && (
            <line
              x1={0}
              x2={xScale.range()[1]}
              y1={Math.round(yScale(0))}
              y2={Math.round(yScale(0))}
              stroke="rgba(111, 119, 133, 0.2)"
              strokeDasharray="2 2"
              shapeRendering="crispEdges"
            />
          )}

          {histBars.map((bar) => (
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

          {group.outputs
            .filter((output) => output.fillValues)
            .map((output) => {
              let d = ''
              let segment: Array<{ x: number; a: number; b: number }> = []
              const points = (side: 'a' | 'b', kind: 'line' | 'step') => {
                const result: Array<{ x: number; y: number }> = []
                segment.forEach((point, i) => {
                  const value = point[side]
                  if (i > 0 && kind === 'step')
                    result.push({ x: point.x, y: yScale(segment[i - 1][side]) })
                  result.push({ x: point.x, y: yScale(value) })
                })
                return result
              }
              const flush = () => {
                if (segment.length > 1) {
                  const top = points('a', output.kind === 'step' ? 'step' : 'line')
                  const bottom = points('b', output.fillKind === 'step' ? 'step' : 'line').reverse()
                  d += ` M ${top[0].x} ${top[0].y} ${top
                    .slice(1)
                    .map((p) => `L ${p.x} ${p.y}`)
                    .join(' ')} ${bottom.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`
                }
                segment = []
              }
              allBars.forEach((bar, i) => {
                const a = output.values[i],
                  b = output.fillValues?.[i]
                if (!visibleSet.has(bar.timestamp) || a == null || b == null) {
                  flush()
                  return
                }
                const x = (xScale(bar.timestamp) ?? 0) + xScale.bandwidth() / 2
                segment.push({ x, a, b })
              })
              flush()
              return (
                <path
                  key={`${output.outputKey}-fill`}
                  data-testid={`market-study-oscillator-fill-${output.outputKey}`}
                  d={d.trim()}
                  fill={output.color ?? primaryColor}
                  fillOpacity={output.fillOpacity ?? 0.15}
                  stroke="none"
                />
              )
            })}

          {lineOutputs.map((output) => {
            const color =
              output.color ??
              (output.outputKey === 'signal'
                ? (group.config.style?.outputColors?.signal ?? '#c9a227')
                : (group.config.style?.outputColors?.line ?? primaryColor))
            const path =
              output.kind === 'step'
                ? stepPath(output.values, allBars, visibleSet, xScale, yScale)
                : linePath(output.values, allBars, visibleSet, xScale, yScale)
            return (
              <path
                key={`${group.instanceKey}-${output.outputKey}`}
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={output.outputKey === 'signal' ? 1 : 1.2}
                strokeDasharray={output.outputKey === 'signal' ? '3 2' : undefined}
              />
            )
          })}
          {markerOutputs.map((output) =>
            visibleBars.map((bar) => {
              const value = output.values[bar.index] ?? null
              if (
                value == null ||
                ((output.position === 'above-bar' || output.position === 'below-bar') &&
                  value === 0)
              )
                return null
              const x = xScale(bar.timestamp)
              if (x == null) return null
              return (
                <g
                  key={`${output.outputKey}-${bar.timestamp}`}
                  data-testid={`market-study-oscillator-marker-${output.outputKey}`}
                >
                  <title>{`${output.studyName ?? ''} · ${output.seriesLabel ?? output.label}: ${value}`}</title>
                  {studyMarkerShape(
                    output.shape ?? 'circle',
                    x + xScale.bandwidth() / 2,
                    yScale(value),
                    output.size ?? 8,
                    output.color ?? primaryColor,
                  )}
                </g>
              )
            }),
          )}
        </>
      )}

      <text x={4} y={top + 12} fill="#9ca3af" fontSize={9} fontFamily="monospace">
        {group.label}
        {group.unit ? ` (${group.unit})` : ''}
      </text>
    </g>
  )
}

export const OscillatorPane = memo(OscillatorPaneImpl)
