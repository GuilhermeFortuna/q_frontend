import { formatPrice, type PriceFormat } from '@/lib/market/priceFormat'
import type { DrawingAnchor, DrawingObject, FibOptions } from '@/components/charts/drawings/model'
import {
  emptyGeometry,
  extendedSegment,
  pointAt,
  type Label,
  type PlotArea,
  type Point,
  type Segment,
  type ShapeGeometry,
} from '@/components/charts/drawings/geometry'

export const POSITION_PROFIT_COLOR = '#26a69a'
export const POSITION_RISK_COLOR = '#ef5350'
const ZONE_OPACITY = 0.12
const CHANNEL_FILL_OPACITY = 0.08

export type ShapeContext = {
  plot: PlotArea
  format: PriceFormat
  /** Chart y of a price on the price pane. */
  yOfPrice: (price: number) => number
  /** Label for a time, such as the vertical line's axis label. */
  formatTime: (time: number) => string
}

/**
 * Pixel geometry of one drawing. `points` are the anchors already mapped to SVG coordinates;
 * `drawing.anchors` supplies the prices and times the labels need.
 */
export function shapeGeometry(
  drawing: DrawingObject,
  points: readonly Point[],
  ctx: ShapeContext,
): ShapeGeometry {
  const anchors = drawing.anchors
  switch (drawing.type) {
    case 'trendline':
      return trendline(points, anchors, drawing.options, ctx)
    case 'hline':
      return horizontal(points, anchors, ctx)
    case 'hray':
      return horizontalRay(points, anchors, ctx)
    case 'vline':
      return verticalLine(points, anchors, ctx)
    case 'channel':
      return channel(points, drawing.options.showMiddle, drawing.options.fill)
    case 'rect':
      return rectangle(points, drawing.options)
    case 'fib':
      return retracement(points, anchors, drawing.options, ctx)
    case 'fibext':
      return extension(points, anchors, drawing.options, ctx)
    case 'position':
      return position(points, anchors, drawing.options.side, ctx)
    case 'text':
      return textNote(points, drawing.options.text)
  }
}

function trendline(
  points: readonly Point[],
  anchors: readonly DrawingAnchor[],
  options: {
    extendLeft: boolean
    extendRight: boolean
    showAngle: boolean
    showPriceChange: boolean
  },
  ctx: ShapeContext,
): ShapeGeometry {
  const [a, b] = points
  const geometry = emptyGeometry()
  const [from, to] = extendedSegment(
    a,
    b,
    { backward: options.extendLeft, forward: options.extendRight },
    ctx.plot,
  )
  geometry.segments.push({ from, to })
  geometry.handles = [a, b]

  let labelY = b.y - 6
  if (options.showPriceChange) {
    const delta = anchors[1].price - anchors[0].price
    const percent = anchors[0].price !== 0 ? (delta / anchors[0].price) * 100 : 0
    const sign = delta >= 0 ? '+' : ''
    geometry.labels.push({
      x: b.x + 6,
      y: labelY,
      text: `${sign}${formatPrice(delta, ctx.format.digits)} (${sign}${percent.toFixed(2)}%)`,
      tone: 'muted',
    })
    labelY += 13
  }
  if (options.showAngle) {
    const angle = (Math.atan2(a.y - b.y, b.x - a.x) * 180) / Math.PI
    geometry.labels.push({ x: b.x + 6, y: labelY, text: `${angle.toFixed(1)}°`, tone: 'muted' })
  }
  return geometry
}

function horizontal(
  points: readonly Point[],
  anchors: readonly DrawingAnchor[],
  ctx: ShapeContext,
): ShapeGeometry {
  const y = ctx.yOfPrice(anchors[0].price)
  const { plot } = ctx
  return {
    clip: 'price',
    segments: [{ from: { x: plot.left, y }, to: { x: plot.right, y } }],
    fills: [],
    labels: [
      {
        x: plot.right + 2,
        y: y + 4,
        text: formatPrice(anchors[0].price, ctx.format.digits),
        axis: 'right',
      },
    ],
    handles: [{ x: clamp(points[0].x, plot.left, plot.right), y }],
  }
}

function horizontalRay(
  points: readonly Point[],
  anchors: readonly DrawingAnchor[],
  ctx: ShapeContext,
): ShapeGeometry {
  const [origin] = points
  const { plot } = ctx
  const y = origin.y
  const segments: Segment[] =
    origin.x < plot.right ? [{ from: origin, to: { x: plot.right, y } }] : []
  return {
    clip: 'price',
    segments,
    fills: [],
    labels: [
      {
        x: plot.right + 2,
        y: y + 4,
        text: formatPrice(anchors[0].price, ctx.format.digits),
        axis: 'right',
      },
    ],
    handles: [origin],
  }
}

function verticalLine(
  points: readonly Point[],
  anchors: readonly DrawingAnchor[],
  ctx: ShapeContext,
): ShapeGeometry {
  const [origin] = points
  const { plot } = ctx
  const middle = (plot.top + plot.bottom) / 2
  return {
    clip: 'chart',
    segments: [
      { from: { x: origin.x, y: plot.chartTop }, to: { x: origin.x, y: plot.chartBottom } },
    ],
    fills: [],
    labels: [
      {
        x: origin.x,
        y: plot.chartBottom + 14,
        text: ctx.formatTime(anchors[0].time),
        axis: 'bottom',
      },
    ],
    handles: [{ x: origin.x, y: middle }],
  }
}

function channel(points: readonly Point[], showMiddle: boolean, fill: boolean): ShapeGeometry {
  const [a, b, c] = points
  // The third anchor sits on the far edge; the second edge runs through it, parallel to a→b.
  const d = { x: c.x + (b.x - a.x), y: c.y + (b.y - a.y) }
  const segments: Segment[] = [
    { from: a, to: b },
    { from: c, to: d },
  ]
  if (showMiddle) {
    segments.push({ from: pointAt(a, c, 0.5), to: pointAt(b, d, 0.5), guide: true })
  }
  const geometry: ShapeGeometry = {
    clip: 'price',
    segments,
    fills: [],
    labels: [],
    handles: [a, b, c],
  }
  if (fill) {
    geometry.fills.push({ points: [a, b, d, c], opacity: CHANNEL_FILL_OPACITY })
  }
  return geometry
}

function rectangle(
  points: readonly Point[],
  options: { fill: boolean; fillColor: string; fillOpacity: number },
): ShapeGeometry {
  const [a, b] = points
  const left = Math.min(a.x, b.x)
  const right = Math.max(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const bottom = Math.max(a.y, b.y)
  const corners: Point[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ]
  const segments: Segment[] = corners.map((corner, index) => ({
    from: corner,
    to: corners[(index + 1) % corners.length],
  }))
  return {
    clip: 'price',
    segments,
    fills: options.fill
      ? [{ points: corners, color: options.fillColor, opacity: options.fillOpacity }]
      : [],
    labels: [],
    handles: [a, b],
  }
}

function retracement(
  points: readonly Point[],
  anchors: readonly DrawingAnchor[],
  options: FibOptions,
  ctx: ShapeContext,
): ShapeGeometry {
  const [a, b] = points
  // Level 0 sits on the second anchor and level 1 on the first, as on common charting platforms.
  const priceA = anchors[0].price
  const priceB = anchors[1].price
  const left = Math.min(a.x, b.x)
  const right = options.extendRight ? ctx.plot.right : Math.max(a.x, b.x)
  const geometry: ShapeGeometry = {
    clip: 'price',
    segments: [{ from: a, to: b, guide: true }],
    fills: [],
    labels: [],
    handles: [a, b],
  }
  for (const level of options.levels) {
    const price = priceB - (priceB - priceA) * level
    const y = ctx.yOfPrice(price)
    geometry.segments.push({ from: { x: left, y }, to: { x: right, y } })
    geometry.labels.push(levelLabel(left + 4, y, level, price, ctx))
  }
  return geometry
}

function extension(
  points: readonly Point[],
  anchors: readonly DrawingAnchor[],
  options: FibOptions,
  ctx: ShapeContext,
): ShapeGeometry {
  const [a, b, c] = points
  const swing = anchors[1].price - anchors[0].price
  const left = c.x
  const right = options.extendRight ? ctx.plot.right : Math.max(a.x, b.x, c.x)
  const geometry: ShapeGeometry = {
    clip: 'price',
    segments: [
      { from: a, to: b, guide: true },
      { from: b, to: c, guide: true },
    ],
    fills: [],
    labels: [],
    handles: [a, b, c],
  }
  for (const level of options.levels) {
    const price = anchors[2].price + swing * level
    const y = ctx.yOfPrice(price)
    geometry.segments.push({ from: { x: left, y }, to: { x: right, y } })
    geometry.labels.push(levelLabel(left + 4, y, level, price, ctx))
  }
  return geometry
}

function levelLabel(x: number, y: number, level: number, price: number, ctx: ShapeContext): Label {
  return {
    x,
    y: y - 3,
    text: `${(level * 100).toFixed(1)}% ${formatPrice(price, ctx.format.digits)}`,
    tone: 'muted',
  }
}

function position(
  points: readonly Point[],
  anchors: readonly DrawingAnchor[],
  side: 'long' | 'short',
  ctx: ShapeContext,
): ShapeGeometry {
  const [entry, stop, target] = points
  const entryPrice = anchors[0].price
  const stopPrice = anchors[1].price
  const targetPrice = anchors[2].price
  const { digits, tickSize } = ctx.format
  const left = Math.min(entry.x, target.x)
  const right = Math.max(entry.x, target.x)
  const yEntry = entry.y
  const yStop = ctx.yOfPrice(stopPrice)
  const yTarget = ctx.yOfPrice(targetPrice)

  const profit = side === 'long' ? targetPrice - entryPrice : entryPrice - targetPrice
  const risk = side === 'long' ? entryPrice - stopPrice : stopPrice - entryPrice
  const ticks = (value: number) => Math.round(Math.abs(value) / tickSize)
  const percent = (value: number) => (entryPrice !== 0 ? (value / entryPrice) * 100 : 0)
  const signed = (value: number) => `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}`
  const reward = risk > 0 ? ` · R:R ${(profit / risk).toFixed(2)}` : ''

  const band = (y: number): Point[] => [
    { x: left, y: yEntry },
    { x: right, y: yEntry },
    { x: right, y },
    { x: left, y },
  ]
  return {
    clip: 'price',
    segments: [
      { from: { x: left, y: yEntry }, to: { x: right, y: yEntry } },
      { from: { x: left, y: yStop }, to: { x: right, y: yStop } },
      { from: { x: left, y: yTarget }, to: { x: right, y: yTarget } },
    ],
    fills: [
      { points: band(yTarget), color: POSITION_PROFIT_COLOR, opacity: ZONE_OPACITY },
      { points: band(yStop), color: POSITION_RISK_COLOR, opacity: ZONE_OPACITY },
    ],
    labels: [
      {
        x: right + 4,
        y: yEntry - 3,
        text: `Entry ${formatPrice(entryPrice, digits)}`,
        tone: 'muted',
      },
      {
        x: right + 4,
        y: yTarget - 3,
        text: `TP ${formatPrice(targetPrice, digits)} · ${ticks(profit)} ticks · ${signed(percent(profit))}%${reward}`,
        tone: 'muted',
      },
      {
        x: right + 4,
        y: yStop - 3,
        text: `SL ${formatPrice(stopPrice, digits)} · ${ticks(risk)} ticks · ${signed(-percent(risk))}%`,
        tone: 'muted',
      },
    ],
    handles: [entry, stop, target],
  }
}

function textNote(points: readonly Point[], text: string): ShapeGeometry {
  const [origin] = points
  return {
    clip: 'price',
    segments: [],
    fills: [],
    labels: [{ x: origin.x, y: origin.y, text }],
    handles: [origin],
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
