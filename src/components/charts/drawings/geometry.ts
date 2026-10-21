/**
 * Pixel-space primitives shared by drawing rendering and hit testing. Every point is an absolute
 * SVG coordinate, so a tool builds one `ShapeGeometry` that both the renderer and the hit test read.
 */

export type Point = { x: number; y: number }

export type PlotArea = {
  /** Left and right edges of the candle area. */
  left: number
  right: number
  /** Top and bottom of the price pane, which drawings are clipped to. */
  top: number
  bottom: number
  /** Top and bottom of the whole chart, including volume and oscillator panes. */
  chartTop: number
  chartBottom: number
}

export type Segment = {
  from: Point
  to: Point
  /** Guide lines are dashed regardless of the drawing's line style. */
  guide?: boolean
}

export type Fill = {
  points: Point[]
  color?: string
  opacity?: number
}

export type Label = {
  x: number
  y: number
  text: string
  /** `axis` labels sit on the price or time axis: they are never clipped and never hit. */
  axis?: 'right' | 'bottom'
  /** Colour of the label text, when it differs from the drawing's stroke. */
  tone?: 'stroke' | 'muted'
}

export type ShapeGeometry = {
  /** `price` clips to the price pane; `chart` lets a drawing span every pane. */
  clip: 'price' | 'chart'
  segments: Segment[]
  fills: Fill[]
  labels: Label[]
  /** Anchor positions for the selection handles. */
  handles: Point[]
}

export const HIT_TOLERANCE_PX = 6

const LABEL_CHAR_WIDTH = 6.3
const LABEL_LINE_HEIGHT = 13
const LABEL_PADDING_X = 4
const LABEL_PADDING_Y = 2

export function distanceToSegment(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - from.x, point.y - from.y)
  const t = Math.max(
    0,
    Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared),
  )
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy))
}

/** Even-odd rule point-in-polygon test. */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

/** Approximate box of a label, used for hit testing and nothing else. */
export function labelBox(label: Label): {
  left: number
  top: number
  right: number
  bottom: number
} {
  const lines = label.text.split('\n')
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0)
  const width = longest * LABEL_CHAR_WIDTH + LABEL_PADDING_X * 2
  const height = lines.length * LABEL_LINE_HEIGHT + LABEL_PADDING_Y * 2
  return {
    left: label.x,
    top: label.y - LABEL_LINE_HEIGHT + LABEL_PADDING_Y,
    right: label.x + width,
    bottom: label.y - LABEL_LINE_HEIGHT + LABEL_PADDING_Y + height,
  }
}

export type HitKind = 'segment' | 'fill' | 'label'

/**
 * Hit test for a drawing body, in priority order: strokes within `tolerance` px, then labels,
 * then filled areas. Handles are tested separately by the caller, before any body.
 */
export function hitTestBody(
  geometry: ShapeGeometry,
  point: Point,
  tolerance = HIT_TOLERANCE_PX,
): HitKind | null {
  for (const segment of geometry.segments) {
    if (distanceToSegment(point, segment.from, segment.to) <= tolerance) return 'segment'
  }
  for (const label of geometry.labels) {
    if (label.axis) continue
    const box = labelBox(label)
    if (
      point.x >= box.left - tolerance &&
      point.x <= box.right + tolerance &&
      point.y >= box.top - tolerance &&
      point.y <= box.bottom + tolerance
    ) {
      return 'label'
    }
  }
  for (const fill of geometry.fills) {
    if (pointInPolygon(point, fill.points)) return 'fill'
  }
  return null
}

/** Index of the handle under `point`, or -1. Handles are squares of `2 * tolerance` px. */
export function hitTestHandle(
  handles: readonly Point[],
  point: Point,
  tolerance = HIT_TOLERANCE_PX,
): number {
  return handles.findIndex(
    (handle) =>
      Math.abs(handle.x - point.x) <= tolerance && Math.abs(handle.y - point.y) <= tolerance,
  )
}

/**
 * The segment from `from` towards `to`, extended backwards and/or forwards along the same line
 * to the plot's left and right edges. Vertical lines are returned unchanged.
 */
export function extendedSegment(
  from: Point,
  to: Point,
  extend: { backward: boolean; forward: boolean },
  plot: PlotArea,
): [Point, Point] {
  const dx = to.x - from.x
  if (Math.abs(dx) < 1e-9) return [from, to]
  const edgeA = (plot.left - from.x) / dx
  const edgeB = (plot.right - from.x) / dx
  const lowest = Math.min(edgeA, edgeB)
  const highest = Math.max(edgeA, edgeB)
  const start = extend.backward ? Math.min(0, lowest) : 0
  const end = extend.forward ? Math.max(1, highest) : 1
  return [pointAt(from, to, start), pointAt(from, to, end)]
}

export function pointAt(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

export function emptyGeometry(clip: ShapeGeometry['clip'] = 'price'): ShapeGeometry {
  return { clip, segments: [], fills: [], labels: [], handles: [] }
}
