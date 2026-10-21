import { describe, expect, it } from 'vitest'

import {
  distanceToSegment,
  extendedSegment,
  hitTestBody,
  hitTestHandle,
  pointInPolygon,
  type PlotArea,
  type ShapeGeometry,
} from '@/components/charts/drawings/geometry'

const plot: PlotArea = { left: 0, right: 200, top: 0, bottom: 100, chartTop: 0, chartBottom: 140 }

function geometry(partial: Partial<ShapeGeometry>): ShapeGeometry {
  return { clip: 'price', segments: [], fills: [], labels: [], handles: [], ...partial }
}

describe('distanceToSegment', () => {
  it('measures to the nearest point on the segment, not the infinite line', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3)
    expect(distanceToSegment({ x: 14, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(4)
  })
})

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  it('is true inside and false outside', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true)
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false)
  })
})

describe('hitTestBody', () => {
  it('selects a line within 6 px and not beyond', () => {
    const line = geometry({ segments: [{ from: { x: 0, y: 50 }, to: { x: 200, y: 50 } }] })
    expect(hitTestBody(line, { x: 100, y: 55.9 })).toBe('segment')
    expect(hitTestBody(line, { x: 100, y: 57 })).toBeNull()
  })

  it('selects a filled area by its interior', () => {
    const rect = geometry({
      fills: [
        {
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
            { x: 50, y: 40 },
            { x: 10, y: 40 },
          ],
        },
      ],
    })
    expect(hitTestBody(rect, { x: 30, y: 25 })).toBe('fill')
    expect(hitTestBody(rect, { x: 70, y: 25 })).toBeNull()
  })

  it('ignores axis labels and hits text labels by their box', () => {
    const geo = geometry({
      labels: [
        { x: 180, y: 50, text: '101.25', axis: 'right' },
        { x: 20, y: 50, text: 'Note' },
      ],
    })
    expect(hitTestBody(geo, { x: 185, y: 45 })).toBeNull()
    expect(hitTestBody(geo, { x: 24, y: 44 })).toBe('label')
  })
})

describe('hitTestHandle', () => {
  it('returns the index of the handle under the pointer, handles first', () => {
    const handles = [
      { x: 10, y: 10 },
      { x: 100, y: 50 },
    ]
    expect(hitTestHandle(handles, { x: 104, y: 47 })).toBe(1)
    expect(hitTestHandle(handles, { x: 50, y: 50 })).toBe(-1)
  })
})

describe('extendedSegment', () => {
  it('reaches the plot edges in the directions asked for', () => {
    const from = { x: 50, y: 50 }
    const to = { x: 80, y: 60 }
    const [, forward] = extendedSegment(from, to, { backward: false, forward: true }, plot)
    expect(forward.x).toBe(200)
    const [back, end] = extendedSegment(from, to, { backward: true, forward: false }, plot)
    expect(back.x).toBe(0)
    expect(end).toEqual(to)
  })

  it('leaves a vertical segment unchanged', () => {
    const from = { x: 50, y: 0 }
    const to = { x: 50, y: 100 }
    expect(extendedSegment(from, to, { backward: true, forward: true }, plot)).toEqual([from, to])
  })
})
