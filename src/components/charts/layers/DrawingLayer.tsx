import { memo, useId } from 'react'

import type { DrawingLineStyle, DrawingObject } from '@/components/charts/drawings/model'
import {
  labelBox,
  type Fill,
  type Label,
  type PlotArea,
  type Point,
  type Segment,
  type ShapeGeometry,
} from '@/components/charts/drawings/geometry'
import { BRASS_COLOR } from '@/components/charts/types/chart'

const SELECTED_HANDLE_SIZE = 7
const MUTED_TEXT_FILL = '#9ca3af'
const LINE_DASH: Record<DrawingLineStyle, string | undefined> = {
  solid: undefined,
  dashed: '6 3',
  dotted: '1 3',
}

export type PlacedDrawing = {
  drawing: DrawingObject
  geometry: ShapeGeometry
}

type DrawingLayerProps = {
  /** Visible drawings, already placed in SVG coordinates. */
  placed: PlacedDrawing[]
  /** The drawing being placed, drawn faint, or null. */
  draft: PlacedDrawing | null
  selectedId: string | null
  hoveredId: string | null
  plot: PlotArea
  /** SVG width, used to keep right-axis labels inside the chart. */
  width: number
}

/** Draws placed drawings. Selection handles are drawn unclipped so they stay grabbable at the edge. */
function DrawingLayerImpl({
  placed,
  draft,
  selectedId,
  hoveredId,
  plot,
  width,
}: DrawingLayerProps) {
  const id = useId()
  const priceClipId = `${id}-price`
  const chartClipId = `${id}-chart`

  return (
    <g data-testid="drawing-layer">
      <defs>
        <clipPath id={priceClipId}>
          <rect
            x={plot.left}
            y={plot.top}
            width={plot.right - plot.left}
            height={plot.bottom - plot.top}
          />
        </clipPath>
        <clipPath id={chartClipId}>
          <rect
            x={plot.left}
            y={plot.chartTop}
            width={plot.right - plot.left}
            height={plot.chartBottom - plot.chartTop}
          />
        </clipPath>
      </defs>

      {placed.map(({ drawing, geometry }) => (
        <DrawingShape
          key={drawing.id}
          drawing={drawing}
          geometry={geometry}
          clipPath={`url(#${geometry.clip === 'chart' ? chartClipId : priceClipId})`}
          selected={drawing.id === selectedId}
          hovered={drawing.id === hoveredId}
        />
      ))}

      {placed.map(({ drawing, geometry }) => (
        <AxisLabels key={`axis-${drawing.id}`} geometry={geometry} width={width} />
      ))}

      {placed.map(({ drawing, geometry }) =>
        drawing.id === selectedId ? (
          <Handles
            key={`handles-${drawing.id}`}
            points={geometry.handles}
            locked={drawing.locked}
          />
        ) : null,
      )}

      {draft && (
        <g opacity={0.6} data-testid="drawing-draft">
          <DrawingShape
            drawing={draft.drawing}
            geometry={draft.geometry}
            clipPath={`url(#${draft.geometry.clip === 'chart' ? chartClipId : priceClipId})`}
            selected={false}
            hovered={false}
          />
        </g>
      )}
    </g>
  )
}

export const DrawingLayer = memo(DrawingLayerImpl)

function DrawingShape({
  drawing,
  geometry,
  clipPath,
  selected,
  hovered,
}: {
  drawing: DrawingObject
  geometry: ShapeGeometry
  clipPath: string
  selected: boolean
  hovered: boolean
}) {
  const { color, width, lineStyle } = drawing.style
  const strokeWidth = hovered || selected ? width + 0.5 : width
  return (
    <g clipPath={clipPath} data-drawing-id={drawing.id} data-drawing-type={drawing.type}>
      {geometry.fills.map((fill, index) => (
        <FillShape key={index} fill={fill} fallback={color} />
      ))}
      {geometry.segments.map((segment, index) => (
        <SegmentLine
          key={index}
          segment={segment}
          color={color}
          strokeWidth={strokeWidth}
          dash={segment.guide ? '4 3' : LINE_DASH[lineStyle]}
        />
      ))}
      {geometry.labels
        .filter((label) => !label.axis)
        .map((label, index) => (
          <TextLabel key={index} label={label} color={color} />
        ))}
    </g>
  )
}

function FillShape({ fill, fallback }: { fill: Fill; fallback: string }) {
  return (
    <polygon
      points={fill.points.map((point) => `${point.x},${point.y}`).join(' ')}
      fill={fill.color ?? fallback}
      fillOpacity={fill.opacity ?? 0.1}
    />
  )
}

function SegmentLine({
  segment,
  color,
  strokeWidth,
  dash,
}: {
  segment: Segment
  color: string
  strokeWidth: number
  dash: string | undefined
}) {
  return (
    <line
      x1={segment.from.x}
      y1={segment.from.y}
      x2={segment.to.x}
      y2={segment.to.y}
      stroke={color}
      strokeWidth={segment.guide ? Math.max(strokeWidth - 0.5, 1) : strokeWidth}
      strokeDasharray={dash}
      strokeLinecap="round"
    />
  )
}

function TextLabel({ label, color }: { label: Label; color: string }) {
  const fill = label.tone === 'muted' ? MUTED_TEXT_FILL : color
  const lines = label.text.split('\n')
  return (
    <text x={label.x} y={label.y} fill={fill} fontSize={11} fontFamily="monospace">
      {lines.map((line, index) => (
        <tspan key={index} x={label.x} dy={index === 0 ? 0 : 13}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

function AxisLabels({ geometry, width }: { geometry: ShapeGeometry; width: number }) {
  return (
    <>
      {geometry.labels
        .filter((label) => label.axis)
        .map((label, index) => {
          const box = labelBox(label)
          const boxWidth = box.right - box.left
          const x = Math.min(label.x, width - boxWidth - 1)
          return (
            <g key={index} pointerEvents="none">
              <rect
                x={x}
                y={box.top}
                width={boxWidth}
                height={box.bottom - box.top}
                rx={3}
                fill={BRASS_COLOR}
              />
              <text
                x={x + 4}
                y={label.y}
                fill="#07101c"
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {label.text}
              </text>
            </g>
          )
        })}
    </>
  )
}

function Handles({ points, locked = false }: { points: Point[]; locked?: boolean }) {
  return (
    <g pointerEvents="none" data-testid="drawing-handles" data-locked={locked || undefined}>
      {points.map((point, index) => (
        <rect
          key={index}
          x={point.x - SELECTED_HANDLE_SIZE / 2}
          y={point.y - SELECTED_HANDLE_SIZE / 2}
          width={SELECTED_HANDLE_SIZE}
          height={SELECTED_HANDLE_SIZE}
          rx={1.5}
          fill="#07101c"
          stroke={locked ? MUTED_TEXT_FILL : '#c9a227'}
          strokeWidth={1.2}
        />
      ))}
    </g>
  )
}
