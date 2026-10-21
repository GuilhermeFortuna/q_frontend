/**
 * Drawing data model. Anchors are epoch-millisecond instants and prices, so a drawing keeps its
 * place when the timeframe, the loaded history or the viewport changes.
 */

/** A point on the chart: the instant it marks and the price it sits at. */
export type DrawingAnchor = {
  time: number
  price: number
}

export type DrawingLineStyle = 'solid' | 'dashed' | 'dotted'

export type DrawingStyle = {
  color: string
  width: 1 | 2 | 3 | 4
  lineStyle: DrawingLineStyle
}

export const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const
export const FIB_EXTENSION_LEVELS = [0, 0.618, 1, 1.618, 2.618] as const

export type NoOptions = Record<string, never>

export type TrendlineOptions = {
  extendLeft: boolean
  extendRight: boolean
  showAngle: boolean
  showPriceChange: boolean
}

export type ChannelOptions = {
  showMiddle: boolean
  fill: boolean
}

export type RectangleOptions = {
  fill: boolean
  fillColor: string
  fillOpacity: number
}

export type FibOptions = {
  /** Enabled levels, as fractions (0.618 is 61.8 %). */
  levels: number[]
  extendRight: boolean
}

export type PositionOptions = {
  side: 'long' | 'short'
}

export type TextOptions = {
  text: string
}

export type DrawingOptions = {
  trendline: TrendlineOptions
  hline: NoOptions
  hray: NoOptions
  vline: NoOptions
  channel: ChannelOptions
  rect: RectangleOptions
  fib: FibOptions
  fibext: FibOptions
  position: PositionOptions
  text: TextOptions
}

export type DrawingType = keyof DrawingOptions

export type DrawingObject = {
  [K in DrawingType]: {
    id: string
    type: K
    anchors: DrawingAnchor[]
    style: DrawingStyle
    locked: boolean
    hidden: boolean
    options: DrawingOptions[K]
  }
}[DrawingType]

/** Tools that place a drawing when the chart is clicked. `long` and `short` store a `position`. */
export type PlacementTool =
  | 'trendline'
  | 'hline'
  | 'hray'
  | 'vline'
  | 'channel'
  | 'rect'
  | 'fib'
  | 'fibext'
  | 'long'
  | 'short'
  | 'text'

/** The armed tool: `cursor` selects, moves and measures; the rest place a drawing. */
export type DrawingTool = 'cursor' | PlacementTool

export const ANCHOR_COUNT: Record<DrawingType, number> = {
  trendline: 2,
  hline: 1,
  hray: 1,
  vline: 1,
  channel: 3,
  rect: 2,
  fib: 2,
  fibext: 3,
  position: 3,
  text: 1,
}

export const DEFAULT_DRAWING_COLOR = '#c9a227'
export const BULL_DRAWING_COLOR = '#26a69a'
export const BEAR_DRAWING_COLOR = '#ef5350'

export const DRAWING_WIDTHS = [1, 2, 3, 4] as const
export const DRAWING_LINE_STYLES: readonly DrawingLineStyle[] = ['solid', 'dashed', 'dotted']

export function anchorCountFor(tool: PlacementTool): number {
  return ANCHOR_COUNT[placementType(tool)]
}

/** The stored drawing type a placement tool creates. */
export function placementType(tool: PlacementTool): DrawingType {
  return tool === 'long' || tool === 'short' ? 'position' : tool
}

export function defaultStyleFor(tool: PlacementTool): DrawingStyle {
  const color =
    tool === 'long'
      ? BULL_DRAWING_COLOR
      : tool === 'short'
        ? BEAR_DRAWING_COLOR
        : DEFAULT_DRAWING_COLOR
  return { color, width: 1, lineStyle: 'solid' }
}

export function defaultOptionsFor(tool: PlacementTool): DrawingOptions[DrawingType] {
  switch (tool) {
    case 'trendline':
      return { extendLeft: false, extendRight: false, showAngle: false, showPriceChange: false }
    case 'hline':
    case 'hray':
    case 'vline':
      return {}
    case 'channel':
      return { showMiddle: false, fill: true }
    case 'rect':
      return { fill: true, fillColor: DEFAULT_DRAWING_COLOR, fillOpacity: 0.12 }
    case 'fib':
      return { levels: [...FIB_RETRACEMENT_LEVELS], extendRight: true }
    case 'fibext':
      return { levels: [...FIB_EXTENSION_LEVELS], extendRight: true }
    case 'long':
      return { side: 'long' }
    case 'short':
      return { side: 'short' }
    case 'text':
      return { text: 'Note' }
  }
}

/** The placement tool that creates each stored type, with its default options. */
export const PLACEMENT_FOR_TYPE: Record<DrawingType, PlacementTool> = {
  trendline: 'trendline',
  hline: 'hline',
  hray: 'hray',
  vline: 'vline',
  channel: 'channel',
  rect: 'rect',
  fib: 'fib',
  fibext: 'fibext',
  position: 'long',
  text: 'text',
}
