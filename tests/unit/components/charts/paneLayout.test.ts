import { describe, expect, it } from 'vitest'

import {
  computePaneLayout,
  dropTarget,
  movePane,
  resizeBoundary,
  resolvePaneOrder,
} from '@/components/charts/paneLayout'

const MARGINS = { top: 10, right: 60, bottom: 20, left: 5 }
const WIDTH = 800
const HEIGHT = 620
const INNER_HEIGHT = HEIGHT - MARGINS.top - MARGINS.bottom

describe('computePaneLayout', () => {
  it('keeps the default stack when no preferences are saved', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['a', 'b'], MARGINS)

    expect(layout.priceTop).toBe(MARGINS.top)
    expect(layout.volumeTop).toBeCloseTo(MARGINS.top + layout.priceHeight)
    expect(layout.oscillators.map((slot) => slot.key)).toEqual(['a', 'b'])
    expect(layout.oscillators[0].height).toBeCloseTo(INNER_HEIGHT * 0.14)
    expect(layout.volumeHeight).toBeCloseTo(INNER_HEIGHT * 0.18)
    expect(layout.priceHeight + layout.volumeHeight + 2 * INNER_HEIGHT * 0.14).toBeCloseTo(
      INNER_HEIGHT,
    )
  })

  it('places a reordered oscillator above the price pane', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['a'], MARGINS, {
      order: ['a', 'price', 'volume'],
    })

    expect(layout.oscillators[0].top).toBe(MARGINS.top)
    expect(layout.priceTop).toBeCloseTo(MARGINS.top + layout.oscillators[0].height)
    expect(layout.stack.map((slot) => slot.key)).toEqual(['a', 'price', 'volume'])
  })

  it('uses the saved height fraction for an oscillator', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['a'], MARGINS, {
      heights: { a: 0.3 },
    })

    expect(layout.oscillators[0].height).toBeCloseTo(INNER_HEIGHT * 0.3)
  })

  it('ignores stored keys for indicators that no longer exist', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['b'], MARGINS, {
      order: ['gone', 'b', 'price', 'volume'],
    })

    expect(layout.stack.map((slot) => slot.key)).toEqual(['b', 'price', 'volume'])
  })

  it('keeps the price pane readable when oscillators crowd it out', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const layout = computePaneLayout(WIDTH, HEIGHT, keys, MARGINS)

    expect(layout.priceHeight).toBeGreaterThan(0)
    expect(layout.priceHeight).toBeGreaterThanOrEqual(Math.min(120, INNER_HEIGHT / 2) - 0.001)
    expect(layout.stack.reduce((sum, slot) => sum + slot.height, 0)).toBeCloseTo(INNER_HEIGHT)
  })
})

describe('resolvePaneOrder', () => {
  it('appends oscillators missing from storage in default order', () => {
    expect(resolvePaneOrder(['a', 'b'], ['b'])).toEqual(['b', 'price', 'volume', 'a'])
  })
})

describe('resizeBoundary', () => {
  it('moves height between two oscillators and keeps the price pane fixed', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['a', 'b'], MARGINS)
    const boundary = layout.stack.findIndex((slot) => slot.key === 'b')

    const heights = resizeBoundary(layout.stack, INNER_HEIGHT, boundary, 10, {})
    const resized = computePaneLayout(WIDTH, HEIGHT, ['a', 'b'], MARGINS, { heights })

    expect(resized.oscillators[0].height).toBeCloseTo(layout.oscillators[0].height + 10)
    expect(resized.oscillators[1].height).toBeCloseTo(layout.oscillators[1].height - 10)
    expect(resized.priceHeight).toBeCloseTo(layout.priceHeight)
  })

  it('grows an oscillator into the volume pane above it', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['a'], MARGINS)
    const boundary = layout.stack.findIndex((slot) => slot.key === 'a')

    const heights = resizeBoundary(layout.stack, INNER_HEIGHT, boundary, -20, {})
    const resized = computePaneLayout(WIDTH, HEIGHT, ['a'], MARGINS, { heights })

    expect(resized.oscillators[0].height).toBeCloseTo(layout.oscillators[0].height + 20)
    expect(resized.volumeHeight).toBeCloseTo(layout.volumeHeight - 20)
    expect(resized.priceHeight).toBeCloseTo(layout.priceHeight)
  })

  it('stops at the minimum oscillator height', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['a'], MARGINS)
    const boundary = layout.stack.findIndex((slot) => slot.key === 'a')

    const heights = resizeBoundary(layout.stack, INNER_HEIGHT, boundary, 10_000, {})
    const resized = computePaneLayout(WIDTH, HEIGHT, ['a'], MARGINS, { heights })

    expect(resized.oscillators[0].height).toBeGreaterThanOrEqual(48 - 0.001)
    expect(resized.priceHeight).toBeGreaterThanOrEqual(120 - 0.001)
  })
})

describe('movePane and dropTarget', () => {
  it('moves a pane to the top when released above the price pane', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['a', 'b'], MARGINS)
    const target = dropTarget(layout.stack, 'b', MARGINS.top + 2)

    expect(target.index).toBe(0)
    expect(target.lineY).toBe(MARGINS.top)
    expect(movePane(['price', 'volume', 'a', 'b'], 'b', target.index)).toEqual([
      'b',
      'price',
      'volume',
      'a',
    ])
  })

  it('moves a pane to the bottom when released below the last pane', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['a', 'b'], MARGINS)
    const target = dropTarget(layout.stack, 'a', HEIGHT)

    expect(movePane(['price', 'volume', 'a', 'b'], 'a', target.index)).toEqual([
      'price',
      'volume',
      'b',
      'a',
    ])
  })

  it('keeps the order when a pane is released where it started', () => {
    const layout = computePaneLayout(WIDTH, HEIGHT, ['a', 'b'], MARGINS)
    const slot = layout.stack.find((item) => item.key === 'a')!
    const target = dropTarget(layout.stack, 'a', slot.top + slot.height / 2)

    expect(movePane(['price', 'volume', 'a', 'b'], 'a', target.index)).toEqual([
      'price',
      'volume',
      'a',
      'b',
    ])
  })
})
