import { memo, type ReactNode } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { ProcessedBar } from '@/components/charts/types/chart'
import { studyMarkerShape, studyMarkerY } from '@/components/charts/layers/MarkerGlyph'
import {
  linePath,
  pairedFillPath,
  stepPath,
  visibleTimestampSet,
} from '@/components/charts/utils/indicatorPaths'
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

const DEFAULT_INDICATOR_COLOR = '#c9a227'
const DEFAULT_INDICATOR_WIDTH = 1.2
const DASH_PATTERNS = { solid: undefined, dashed: '4 2', dotted: '1 3' } as const

/** Stroke attributes for an indicator, falling back to the chart defaults for unset fields. */
export function indicatorStroke(ind: ChartIndicatorSeries) {
  const style = ind.line_style ?? 'solid'
  return {
    stroke: ind.color ?? DEFAULT_INDICATOR_COLOR,
    strokeWidth: ind.line_width ?? DEFAULT_INDICATOR_WIDTH,
    strokeDasharray: DASH_PATTERNS[style],
    strokeLinecap: style === 'dotted' ? ('round' as const) : undefined,
  }
}

type SeriesContext = {
  allBars: OhlcvBar[]
  visibleBars: ProcessedBar[]
  visibleSet: Set<string>
  xScale: BandScale
  yScale: LinearScale
}

/** Kind of a series; results stored before plot kinds existed are lines. */
function seriesKind(ind: ChartIndicatorSeries) {
  return ind.kind ?? 'line'
}

/** Filled area from a series to its `fill_to` target in the same pane, drawn beneath the lines. */
function fillElements(
  ind: ChartIndicatorSeries,
  indicators: ChartIndicatorSeries[],
  ctx: SeriesContext,
): ReactNode[] {
  if (!ind.fill_to) return []
  const target = indicators.find((other) => other.key === ind.fill_to)
  if (!target) return []
  const kind = seriesKind(ind)
  const d = pairedFillPath(
    ind.values,
    target.values,
    kind === 'step' ? 'step' : 'line',
    seriesKind(target) === 'step' ? 'step' : 'line',
    ctx.allBars,
    ctx.visibleSet,
    ctx.xScale,
    ctx.yScale,
  )
  if (!d) return []
  return [
    <path
      key={`${ind.key}-fill`}
      data-testid={`backtest-indicator-fill-${ind.key}`}
      d={d}
      fill={ind.color ?? DEFAULT_INDICATOR_COLOR}
      fillOpacity={ind.fill_opacity ?? 0.15}
      stroke="none"
    />,
  ]
}

/**
 * Horizontal segment from each segment start bar to the bar holding its value. A start bar
 * before the visible window is clamped to the window's first bar; segments that end before
 * the window are skipped.
 */
function segmentPath(ind: ChartIndicatorSeries, ctx: SeriesContext): string {
  const bw = ctx.xScale.bandwidth()
  const firstVisible = ctx.allBars.findIndex((bar) => ctx.visibleSet.has(bar.timestamp))
  if (firstVisible < 0) return ''
  let d = ''
  ind.values.forEach((value, end) => {
    const start = ind.start_index?.[end]
    if (value == null || start == null || start > end) return
    if (!ctx.visibleSet.has(ctx.allBars[end].timestamp)) return
    const from = Math.max(start, firstVisible)
    const x1 = (ctx.xScale(ctx.allBars[from].timestamp) ?? 0) + bw / 2
    const x2 = (ctx.xScale(ctx.allBars[end].timestamp) ?? 0) + bw / 2
    const y = ctx.yScale(value)
    d += ` M ${x1} ${y} L ${x2} ${y}`
  })
  return d.trim()
}

/** One glyph per visible non-null value; above/below-bar markers skip zeros, like studies. */
function markerElements(ind: ChartIndicatorSeries, ctx: SeriesContext): ReactNode[] {
  const position = ind.position ?? 'value'
  const size = ind.size ?? 8
  const color = ind.color ?? DEFAULT_INDICATOR_COLOR
  const elements: ReactNode[] = []
  for (const bar of ctx.visibleBars) {
    const value = ind.values[bar.index]
    if (value == null || ((position === 'above-bar' || position === 'below-bar') && value === 0)) {
      continue
    }
    const x = ctx.xScale(bar.timestamp)
    if (x == null) continue
    const cy = studyMarkerY(position, value, bar, size, ctx.yScale)
    elements.push(
      <g key={`${ind.key}-${bar.timestamp}`} data-testid={`backtest-indicator-marker-${ind.key}`}>
        <title>{`${ind.label}: ${value}`}</title>
        {studyMarkerShape(ind.shape ?? 'circle', x + ctx.xScale.bandwidth() / 2, cy, size, color)}
      </g>,
    )
  }
  return elements
}

/** Bars from the baseline to each visible value; negative values use `negative_color` when set. */
function histogramElements(ind: ChartIndicatorSeries, ctx: SeriesContext): ReactNode[] {
  const baseline = ind.baseline ?? 0
  const zero = ctx.yScale(baseline)
  const bw = ctx.xScale.bandwidth()
  const elements: ReactNode[] = []
  for (const bar of ctx.visibleBars) {
    const value = ind.values[bar.index]
    if (value == null) continue
    const x = ctx.xScale(bar.timestamp)
    if (x == null) continue
    const y = ctx.yScale(value)
    const negative = value < baseline && ind.negative_color
    elements.push(
      <rect
        key={`${ind.key}-${bar.timestamp}`}
        data-testid={`backtest-indicator-histogram-${ind.key}`}
        x={x + bw * 0.2}
        y={Math.min(y, zero)}
        width={bw * 0.6}
        height={Math.max(Math.abs(y - zero), 1)}
        fill={negative ? ind.negative_color! : (ind.color ?? DEFAULT_INDICATOR_COLOR)}
      />,
    )
  }
  return elements
}

/** Line or step path, the default for series without a kind. */
function lineElement(ind: ChartIndicatorSeries, ctx: SeriesContext): ReactNode {
  const d =
    seriesKind(ind) === 'step'
      ? stepPath(ind.values, ctx.allBars, ctx.visibleSet, ctx.xScale, ctx.yScale)
      : linePath(ind.values, ctx.allBars, ctx.visibleSet, ctx.xScale, ctx.yScale)
  return (
    <path
      key={ind.key}
      data-testid={`backtest-indicator-line-${ind.key}`}
      d={d}
      fill="none"
      {...indicatorStroke(ind)}
    />
  )
}

function contextFor(
  allBars: OhlcvBar[],
  visibleBars: ProcessedBar[],
  xScale: BandScale,
  yScale: LinearScale,
): SeriesContext {
  return {
    allBars,
    visibleBars,
    visibleSet: visibleTimestampSet(visibleBars.map((bar) => bar.timestamp)),
    xScale,
    yScale,
  }
}

function StrategyIndicatorLayerImpl({
  allBars,
  visibleBars,
  xScale,
  yScale,
  indicators,
  left,
}: StrategyIndicatorLayerProps) {
  const ctx = contextFor(allBars, visibleBars, xScale, yScale)
  const priceIndicators = indicators.filter((ind) => ind.pane === 'price')

  return (
    <g transform={`translate(${left}, 0)`}>
      {priceIndicators.flatMap((ind) => fillElements(ind, priceIndicators, ctx))}
      {priceIndicators.map((ind) => {
        const kind = seriesKind(ind)
        if (kind === 'markers') return <g key={ind.key}>{markerElements(ind, ctx)}</g>
        if (kind === 'segment')
          return (
            <path
              key={ind.key}
              data-testid={`backtest-indicator-segment-${ind.key}`}
              d={segmentPath(ind, ctx)}
              fill="none"
              {...indicatorStroke(ind)}
            />
          )
        return lineElement(ind, ctx)
      })}
    </g>
  )
}

function StrategyOscillatorLayerImpl({
  allBars,
  visibleBars,
  xScale,
  yScale,
  indicators,
  top,
  height,
  left,
}: StrategyIndicatorLayerProps & { top: number; height: number }) {
  const ctx = contextFor(allBars, visibleBars, xScale, yScale)
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
      {oscillatorIndicators.flatMap((ind) => fillElements(ind, oscillatorIndicators, ctx))}
      {oscillatorIndicators.map((ind) => {
        const kind = seriesKind(ind)
        let body: ReactNode
        if (kind === 'histogram') body = <g>{histogramElements(ind, ctx)}</g>
        else if (kind === 'markers') body = <g>{markerElements(ind, ctx)}</g>
        else body = lineElement(ind, ctx)
        return (
          <g key={ind.key}>
            {body}
            <text x={4} y={top + 12} fill="#9ca3af" fontSize={9} fontFamily="monospace">
              {ind.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export const StrategyIndicatorLayer = memo(StrategyIndicatorLayerImpl)
export const StrategyOscillatorLayer = memo(StrategyOscillatorLayerImpl)
