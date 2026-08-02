import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { AxisLeft } from '@visx/axis'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleLinear, scalePoint } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { interpolateViridis } from 'd3'

import { CHART_COLORS } from '@/components/backtests/chartUtils'
import { GlowCard } from '@/components/ui/spotlight-card'
import { cn } from '@/lib/utils'
import type { ParallelCoordinatePayload, ParallelCoordinateRow } from '@/types/optimization'

const CHART_MIN_HEIGHT_PX = 280
const MARGIN = { top: 12, right: 16, bottom: 12, left: 48 }

type ParallelCoordinatePanelProps = {
  payload: ParallelCoordinatePayload
  className?: string
}

type DimensionScale =
  | { kind: 'numeric'; scale: ReturnType<typeof scaleLinear<number>> }
  | { kind: 'categorical'; scale: ReturnType<typeof scalePoint<string>> }

export function ParallelCoordinatePanel({ payload, className }: ParallelCoordinatePanelProps) {
  if (payload.rows.length === 0) {
    return (
      <PanelFrame title="Parallel Coordinate" className={className}>
        <EmptyState message="Trial polylines will appear here as trials complete." />
      </PanelFrame>
    )
  }

  return (
    <PanelFrame title="Parallel Coordinate" className={className}>
      {payload.rows_capped ? (
        <p className="text-silver-500 mb-2 shrink-0 text-xs">
          Showing the most recent {payload.rows.length.toLocaleString()} completed trials.
        </p>
      ) : null}
      <div
        className="min-h-0 w-full flex-1 overflow-hidden"
        style={{ minHeight: CHART_MIN_HEIGHT_PX }}
      >
        <ParentSize debounceTime={50}>
          {({ width, height }) =>
            width > 0 && height > 0 ? (
              <ParallelCoordinateChart payload={payload} width={width} height={height} />
            ) : null
          }
        </ParentSize>
      </div>
    </PanelFrame>
  )
}

function ParallelCoordinateChart({
  payload,
  width,
  height,
}: {
  payload: ParallelCoordinatePayload
  width: number
  height: number
}) {
  const dimensions = useMemo(
    () => [...payload.params, ...payload.objectives],
    [payload.params, payload.objectives],
  )

  const chartModel = useMemo(
    () => buildChartModel(payload, dimensions, width, height),
    [payload, dimensions, width, height],
  )

  return (
    <svg width={width} height={height}>
      <Group>
        {chartModel.lines.map((line) => (
          <LinePath
            key={line.key}
            data={line.points}
            x={(point) => point.x}
            y={(point) => point.y}
            stroke={line.color}
            strokeOpacity={0.25}
            strokeWidth={1.2}
            fill="none"
          />
        ))}
      </Group>
      <Group>
        {chartModel.axes.map((axis) => (
          <Group key={axis.label} left={axis.x} top={MARGIN.top}>
            <line
              x1={0}
              x2={0}
              y1={0}
              y2={chartModel.innerHeight}
              stroke={CHART_COLORS.grid}
              strokeWidth={1}
            />
            <AxisLeft
              scale={axis.tickScale}
              hideAxisLine
              hideTicks
              tickLabelProps={() => ({
                fill: CHART_COLORS.axis,
                fontSize: 10,
                textAnchor: 'end',
                dx: -4,
              })}
              numTicks={4}
            />
            <text
              x={0}
              y={-4}
              textAnchor="middle"
              fill={CHART_COLORS.axis}
              fontSize={10}
              transform={`rotate(-90, 0, ${-4})`}
            >
              {axis.label}
            </text>
          </Group>
        ))}
      </Group>
    </svg>
  )
}

function buildChartModel(
  payload: ParallelCoordinatePayload,
  dimensions: string[],
  width: number,
  height: number,
) {
  const innerHeight = Math.max(1, height - MARGIN.top - MARGIN.bottom)
  const innerWidth = Math.max(1, width - MARGIN.left - MARGIN.right)
  const xScale = scalePoint<string>({
    domain: dimensions,
    range: [MARGIN.left, MARGIN.left + innerWidth],
    padding: 0.2,
  })

  const dimensionScales = new Map<string, DimensionScale>()
  for (const dimension of dimensions) {
    const isObjective = payload.objectives.includes(dimension)
    const values = payload.rows.map((row) =>
      readDimensionValue(row, dimension, payload, isObjective),
    )
    const numericValues = values.filter((value): value is number => typeof value === 'number')
    if (numericValues.length === values.length && numericValues.length > 0) {
      const min = Math.min(...numericValues)
      const max = Math.max(...numericValues)
      const span = max - min || 1
      dimensionScales.set(dimension, {
        kind: 'numeric',
        scale: scaleLinear<number>({
          domain: [min - span * 0.05, max + span * 0.05],
          range: [innerHeight, 0],
          nice: true,
        }),
      })
      continue
    }

    const categories = [...new Set(values.map((value) => String(value)))]
    dimensionScales.set(dimension, {
      kind: 'categorical',
      scale: scalePoint<string>({
        domain: categories,
        range: [innerHeight, 0],
        padding: 0.25,
      }),
    })
  }

  const objectiveValues = payload.rows.map((row) => row.values[0] ?? 0)
  const colorMin = Math.min(...objectiveValues)
  const colorMax = Math.max(...objectiveValues)
  const colorSpan = colorMax - colorMin || 1
  const colorScale = (value: number) => interpolateViridis((value - colorMin) / colorSpan)

  const lines = payload.rows.map((row) => {
    const points = dimensions.map((dimension) => {
      const isObjective = payload.objectives.includes(dimension)
      const raw = readDimensionValue(row, dimension, payload, isObjective)
      const scale = dimensionScales.get(dimension)
      const x = xScale(dimension) ?? MARGIN.left
      const y =
        scale?.kind === 'numeric'
          ? scale.scale(typeof raw === 'number' ? raw : Number(raw)) + MARGIN.top
          : scale?.kind === 'categorical'
            ? (scale.scale(String(raw)) ?? innerHeight / 2) + MARGIN.top
            : MARGIN.top + innerHeight / 2
      return { x, y }
    })
    return {
      key: row.number,
      color: colorScale(row.values[0] ?? 0),
      points,
    }
  })

  const axes = dimensions.map((dimension) => {
    const scale = dimensionScales.get(dimension)
    const tickScale =
      scale?.kind === 'numeric'
        ? scale.scale
        : scale?.kind === 'categorical'
          ? scaleLinear<number>({
              domain: [0, Math.max(scale.scale.domain().length - 1, 1)],
              range: [innerHeight, 0],
            })
          : scaleLinear<number>({ domain: [0, 1], range: [innerHeight, 0] })

    return {
      label: dimension,
      x: xScale(dimension) ?? MARGIN.left,
      tickScale,
    }
  })

  return { lines, axes, innerHeight }
}

function readDimensionValue(
  row: ParallelCoordinateRow,
  dimension: string,
  payload: ParallelCoordinatePayload,
  isObjective: boolean,
) {
  if (isObjective) {
    const index = payload.objectives.indexOf(dimension)
    return row.values[index] ?? 0
  }
  return row.params[dimension] ?? 0
}

function PanelFrame({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <GlowCard
      intensity="card"
      className={cn('flex min-h-0 flex-1 flex-col rounded-lg p-4', className)}
    >
      <h4 className="text-silver-200 mb-3 shrink-0 text-sm font-medium">{title}</h4>
      {children}
    </GlowCard>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="text-silver-500 flex flex-1 items-center justify-center px-4 text-center text-sm"
      style={{ minHeight: CHART_MIN_HEIGHT_PX }}
    >
      {message}
    </div>
  )
}
