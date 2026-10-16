import type {
  ChartMargins,
  OscillatorPaneSlot,
  PaneLayout,
  PaneLayoutPrefs,
} from '@/components/charts/types/chart'

export const PRICE_PANE = 'price'
export const VOLUME_PANE = 'volume'

const VOLUME_RATIO = 0.18
const OSCILLATOR_RATIO = 0.14
const MIN_PRICE_PX = 120
const MIN_VOLUME_PX = 40
const MIN_OSCILLATOR_PX = 48

function defaultRatio(key: string): number {
  return key === VOLUME_PANE ? VOLUME_RATIO : OSCILLATOR_RATIO
}

function minHeight(key: string): number {
  return key === VOLUME_PANE ? MIN_VOLUME_PX : MIN_OSCILLATOR_PX
}

function priceMinHeight(innerHeight: number): number {
  return Math.min(MIN_PRICE_PX, innerHeight / 2)
}

/**
 * Top-to-bottom pane order. Stored keys that no longer exist (an indicator was
 * removed) are dropped; keys missing from storage are appended in default order.
 */
export function resolvePaneOrder(oscillatorKeys: string[], stored?: string[]): string[] {
  const known = new Set([PRICE_PANE, VOLUME_PANE, ...oscillatorKeys])
  const order: string[] = []
  const seen = new Set<string>()
  for (const key of stored ?? []) {
    if (known.has(key) && !seen.has(key)) {
      seen.add(key)
      order.push(key)
    }
  }
  for (const key of [PRICE_PANE, VOLUME_PANE, ...oscillatorKeys]) {
    if (!seen.has(key)) {
      seen.add(key)
      order.push(key)
    }
  }
  return order
}

/**
 * Pixel heights for every pane in the stack. The price pane takes the remainder;
 * when the other panes would squeeze it below its minimum they are scaled down
 * proportionally so the price pane stays readable.
 */
function paneHeights(
  order: string[],
  innerHeight: number,
  heights: PaneLayoutPrefs['heights'] = {},
): Map<string, number> {
  const sizes = new Map<string, number>()
  for (const key of order) {
    if (key === PRICE_PANE) continue
    const ratio = heights[key] ?? defaultRatio(key)
    sizes.set(key, Math.max(minHeight(key), ratio * innerHeight))
  }

  const total = [...sizes.values()].reduce((sum, value) => sum + value, 0)
  const available = Math.max(innerHeight - priceMinHeight(innerHeight), 0)
  if (total > available && total > 0) {
    const factor = available / total
    for (const [key, value] of sizes) sizes.set(key, value * factor)
  }

  const used = [...sizes.values()].reduce((sum, value) => sum + value, 0)
  sizes.set(PRICE_PANE, innerHeight - used)
  return sizes
}

/** Every pane in stack order with its top and height in pixels. */
export function computePaneStack(
  innerHeight: number,
  top: number,
  order: string[],
  heights?: PaneLayoutPrefs['heights'],
): OscillatorPaneSlot[] {
  const sizes = paneHeights(order, innerHeight, heights)
  let cursor = top
  return order.map((key) => {
    const height = sizes.get(key) ?? 0
    const slot = { key, top: cursor, height }
    cursor += height
    return slot
  })
}

export function computePaneLayout(
  width: number,
  height: number,
  oscillatorKeys: string[],
  margins: ChartMargins,
  prefs?: PaneLayoutPrefs,
): PaneLayout {
  const innerWidth = Math.max(width - margins.left - margins.right, 0)
  const innerHeight = Math.max(height - margins.top - margins.bottom, 0)
  const order = resolvePaneOrder(oscillatorKeys, prefs?.order)
  const stack = computePaneStack(innerHeight, margins.top, order, prefs?.heights)

  const price = stack.find((slot) => slot.key === PRICE_PANE)
  const volume = stack.find((slot) => slot.key === VOLUME_PANE)
  const oscillators = stack.filter((slot) => slot.key !== PRICE_PANE && slot.key !== VOLUME_PANE)

  return {
    priceTop: price?.top ?? margins.top,
    priceHeight: price?.height ?? 0,
    volumeTop: volume?.top ?? margins.top,
    volumeHeight: volume?.height ?? 0,
    oscillators,
    stack,
    innerWidth,
    innerHeight,
  }
}

/**
 * Drags the boundary above `stack[boundary]` by `delta` pixels. The pane above
 * grows and the pane below shrinks (or the price pane absorbs the change), within
 * each pane's minimum height. Returns the updated height fractions.
 */
export function resizeBoundary(
  stack: OscillatorPaneSlot[],
  innerHeight: number,
  boundary: number,
  delta: number,
  heights: PaneLayoutPrefs['heights'] = {},
): PaneLayoutPrefs['heights'] {
  const above = stack[boundary - 1]
  const below = stack[boundary]
  if (!above || !below || innerHeight <= 0) return heights

  const price = stack.find((slot) => slot.key === PRICE_PANE)
  const abovePrice = above.key === PRICE_PANE
  const belowPrice = below.key === PRICE_PANE

  let lower = -Infinity
  let upper = Infinity
  if (!abovePrice) lower = Math.max(lower, minHeight(above.key) - above.height)
  if (!belowPrice) upper = Math.min(upper, below.height - minHeight(below.key))
  if (abovePrice && price) lower = Math.max(lower, priceMinHeight(innerHeight) - price.height)
  if (belowPrice && price) upper = Math.min(upper, price.height - priceMinHeight(innerHeight))
  if (lower > upper) return heights

  const d = Math.min(Math.max(delta, lower), upper)
  const next = { ...heights }
  if (!abovePrice) next[above.key] = (above.height + d) / innerHeight
  if (!belowPrice) next[below.key] = (below.height - d) / innerHeight
  return next
}

/**
 * Where a dragged pane would land if released at `pointerY`: the index it takes
 * among the other panes, and the y coordinate of the insertion line.
 */
export function dropTarget(
  stack: OscillatorPaneSlot[],
  key: string,
  pointerY: number,
): { index: number; lineY: number } {
  const rest = stack.filter((slot) => slot.key !== key)
  const index = rest.filter((slot) => slot.top + slot.height / 2 < pointerY).length
  const lineY =
    index < rest.length
      ? rest[index].top
      : rest.length > 0
        ? rest[rest.length - 1].top + rest[rest.length - 1].height
        : 0
  return { index, lineY }
}

/** Moves `key` so it sits at `index` among the other panes. */
export function movePane(order: string[], key: string, index: number): string[] {
  const rest = order.filter((item) => item !== key)
  const clamped = Math.min(Math.max(index, 0), rest.length)
  return [...rest.slice(0, clamped), key, ...rest.slice(clamped)]
}
