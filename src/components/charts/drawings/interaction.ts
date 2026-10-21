import type { LinearScale } from '@/components/charts/types/scales'
import type { ProcessedBar } from '@/components/charts/types/chart'
import type { TimeMapper } from '@/components/charts/drawings/timeMapping'
import {
  defaultOptionsFor,
  defaultStyleFor,
  placementType,
  type DrawingAnchor,
  type DrawingObject,
  type PlacementTool,
} from '@/components/charts/drawings/model'
import type { Point } from '@/components/charts/drawings/geometry'
import { snapToTick, type PriceFormat } from '@/lib/market/priceFormat'

/** Distance within which an anchor snaps to an open, high, low or close. */
export const MAGNET_RADIUS_PX = 10

/** Everything an anchor needs to be read from or written to the chart. */
export type AnchorScene = {
  mapper: TimeMapper
  priceScale: LinearScale
  format: PriceFormat
  /** Loaded bars in order; magnet snapping reads the bar under the pointer. */
  bars: readonly ProcessedBar[]
  magnet: boolean
}

export function pixelOfAnchor(anchor: DrawingAnchor, scene: AnchorScene): Point {
  return { x: scene.mapper.xOfTime(anchor.time), y: scene.priceScale(anchor.price) }
}

/**
 * The anchor under a pointer. With Magnet on, the price snaps to the nearest OHLC of the bar
 * under the pointer when that is within `MAGNET_RADIUS_PX`, and otherwise to the tick size.
 * `fixedPrice` (Shift on a horizontal edge) overrides the price entirely.
 */
export function anchorAtPoint(
  point: Point,
  scene: AnchorScene,
  fixedPrice?: number,
): DrawingAnchor {
  const time = scene.mapper.timeOfX(point.x)
  if (fixedPrice !== undefined) return { time, price: fixedPrice }
  const rawPrice = scene.priceScale.invert(point.y)
  return { time, price: scene.magnet ? magnetPrice(point, rawPrice, scene) : rawPrice }
}

/** Price the crosshair and anchors use at a pointer position, after Magnet. */
export function magnetPrice(point: Point, rawPrice: number, scene: AnchorScene): number {
  const position = Math.round(scene.mapper.positionOfX(point.x))
  const bar = Number.isFinite(position) ? scene.bars[position] : undefined
  if (bar) {
    let best: { price: number; distance: number } | null = null
    for (const price of [bar.open, bar.high, bar.low, bar.close]) {
      const distance = Math.abs(scene.priceScale(price) - point.y)
      if (distance <= MAGNET_RADIUS_PX && (best === null || distance < best.distance)) {
        best = { price, distance }
      }
    }
    if (best) return best.price
  }
  return snapToTick(rawPrice, scene.format.tickSize, scene.format.digits)
}

/** Whether a drawing type's second anchor is an edge that Shift keeps horizontal. */
export function hasHorizontalEdge(type: DrawingObject['type']): boolean {
  return type === 'trendline' || type === 'channel'
}

/**
 * Anchor positions after dragging the whole drawing by a pixel offset. The offset is applied in
 * pixel space and converted back to time and price, so the drawing keeps its shape.
 */
export function moveAnchors(
  anchors: readonly DrawingAnchor[],
  dx: number,
  dy: number,
  scene: AnchorScene,
): DrawingAnchor[] {
  return anchors.map((anchor) => {
    const pixel = pixelOfAnchor(anchor, scene)
    return {
      time: scene.mapper.timeOfX(pixel.x + dx),
      price: scene.priceScale.invert(pixel.y + dy),
    }
  })
}

export function newDrawingId(): string {
  return `draw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Builds a new drawing from its placement tool and anchors. */
export function buildDrawing(
  tool: PlacementTool,
  anchors: readonly DrawingAnchor[],
  id: string,
): DrawingObject {
  return {
    id,
    type: placementType(tool),
    anchors: [...anchors],
    style: defaultStyleFor(tool),
    locked: false,
    hidden: false,
    options: defaultOptionsFor(tool),
  } as DrawingObject
}

/**
 * Which anchor index of a placed drawing sits on the horizontal edge Shift constrains, paired
 * with the anchor it is measured against. Null when the tool has no such edge.
 */
export function horizontalEdgePartner(drawing: DrawingObject, index: number): number | null {
  if (!hasHorizontalEdge(drawing.type)) return null
  if (index === 0) return 1
  if (index === 1) return 0
  return null
}

/** Points for a drawing being placed: the anchors placed so far, then the pointer for the rest. */
export function draftAnchors(
  placed: readonly DrawingAnchor[],
  pointer: DrawingAnchor,
  count: number,
): DrawingAnchor[] {
  const anchors = [...placed]
  while (anchors.length < count) anchors.push(pointer)
  return anchors
}
