import { describe, expect, it } from 'vitest'
import { scaleLinear } from '@visx/scale'

import {
  MAGNET_RADIUS_PX,
  anchorAtPoint,
  buildDrawing,
  draftAnchors,
  horizontalEdgePartner,
  magnetPrice,
  moveAnchors,
  pixelOfAnchor,
  type AnchorScene,
} from '@/components/charts/drawings/interaction'
import { createTimeMapper } from '@/components/charts/drawings/timeMapping'
import { processBars } from '@/components/charts/hooks/useChartScales'
import type { OhlcvBar } from '@/types/api'

const H1 = 3_600_000
const T0 = Date.UTC(2026, 0, 5, 10)
const bars: OhlcvBar[] = [
  { timestamp: new Date(T0).toISOString(), open: 100, high: 104, low: 98, close: 101, volume: 1 },
  {
    timestamp: new Date(T0 + H1).toISOString(),
    open: 101,
    high: 103,
    low: 99,
    close: 102,
    volume: 1,
  },
]
const processed = processBars(bars)
const times = processed.map((bar) => bar.timeMs)

// 10 px per price unit; 100.00 sits at y = 500.
const priceScale = scaleLinear<number>({ domain: [50, 150], range: [1000, 0] })
const mapper = createTimeMapper({
  times,
  timeframeMs: H1,
  startIndex: 0,
  firstSlotX: 50,
  slotStep: 100,
  left: 0,
})

function scene(magnet: boolean, tickSize = 0.5): AnchorScene {
  return {
    mapper,
    priceScale,
    format: { digits: 2, tickSize },
    bars: processed,
    magnet,
  }
}

describe('magnetPrice', () => {
  it('snaps to the nearest OHLC of the bar under the pointer within 10 px', () => {
    // Bar 0 high is 104, six pixels above the 103.4 level under the pointer.
    const y = priceScale(103.4)
    expect(priceScale(104)).toBeCloseTo(y - 6, 6)
    expect(magnetPrice({ x: 50, y }, 103.4, scene(true))).toBe(104)
  })

  it('falls back to the tick size when no OHLC is in reach', () => {
    const y = priceScale(102.3)
    expect(magnetPrice({ x: 50, y }, 102.3, scene(true, 0.5))).toBe(102.5)
    expect(MAGNET_RADIUS_PX).toBe(10)
  })

  it('uses the tick size of the instrument, not a fixed decimal count', () => {
    // 102.5 is 15 px from both the high (104) and the close (101), so nothing magnets.
    expect(magnetPrice({ x: 50, y: priceScale(102.53) }, 102.53, scene(true, 0.05))).toBe(102.55)
  })
})

describe('anchorAtPoint', () => {
  it('keeps the raw price when Magnet is off', () => {
    const anchor = anchorAtPoint({ x: 50, y: priceScale(101.234) }, scene(false))
    expect(anchor.price).toBeCloseTo(101.234, 6)
    // x = 50 is the centre of bar 0, which is the middle of its hour.
    expect(anchor.time).toBeCloseTo(T0 + H1 / 2, 0)
  })

  it('uses a fixed price when a Shift-constrained edge overrides it', () => {
    expect(anchorAtPoint({ x: 50, y: 300 }, scene(true), 99.5).price).toBe(99.5)
  })
})

describe('moveAnchors', () => {
  it('moves every anchor by the same pixel offset, keeping the drawing shape', () => {
    const anchors = [
      { time: T0, price: 100 },
      { time: T0 + H1, price: 102 },
    ]
    const moved = moveAnchors(anchors, 30, -20, scene(false))
    const before = anchors.map((anchor) => pixelOfAnchor(anchor, scene(false)))
    const after = moved.map((anchor) => pixelOfAnchor(anchor, scene(false)))
    expect(after[0].x - before[0].x).toBeCloseTo(30, 6)
    expect(after[1].x - before[1].x).toBeCloseTo(30, 6)
    expect(after[0].y - before[0].y).toBeCloseTo(-20, 6)
    expect(after[1].y - before[1].y).toBeCloseTo(-20, 6)
  })
})

describe('buildDrawing and helpers', () => {
  it('stores a long position as a position with its side', () => {
    const drawing = buildDrawing('long', [{ time: T0, price: 1 }], 'p')
    expect(drawing).toMatchObject({ type: 'position', options: { side: 'long' } })
    expect(drawing.anchors).toHaveLength(1)
  })

  it('pads the anchors of a draft with the pointer until the tool has its full count', () => {
    const pointer = { time: T0 + H1, price: 102 }
    expect(draftAnchors([{ time: T0, price: 100 }], pointer, 3)).toEqual([
      { time: T0, price: 100 },
      pointer,
      pointer,
    ])
  })

  it('pairs the horizontal edge of a trend line or channel with its opposite end', () => {
    const line = buildDrawing(
      'trendline',
      [
        { time: T0, price: 1 },
        { time: T0, price: 2 },
      ],
      'l',
    )
    expect(horizontalEdgePartner(line, 0)).toBe(1)
    expect(horizontalEdgePartner(line, 1)).toBe(0)
    const rect = buildDrawing(
      'rect',
      [
        { time: T0, price: 1 },
        { time: T0, price: 2 },
      ],
      'r',
    )
    expect(horizontalEdgePartner(rect, 0)).toBeNull()
  })
})
