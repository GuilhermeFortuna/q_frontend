import { describe, expect, it } from 'vitest'

import { shapeGeometry, type ShapeContext } from '@/components/charts/drawings/shapes'
import type { DrawingObject } from '@/components/charts/drawings/model'
import type { PlotArea } from '@/components/charts/drawings/geometry'

const plot: PlotArea = { left: 0, right: 400, top: 0, bottom: 200, chartTop: 0, chartBottom: 240 }
const ctx: ShapeContext = {
  plot,
  format: { digits: 2, tickSize: 0.01 },
  // 1 price unit = 10 px, with 100.00 at y = 100.
  yOfPrice: (price) => 100 - (price - 100) * 10,
  formatTime: (time) => `t${time}`,
}
const style = { color: '#c9a227', width: 1 as const, lineStyle: 'solid' as const }
const base = { locked: false, hidden: false, style }

function drawing(partial: Partial<DrawingObject> & Pick<DrawingObject, 'type'>): DrawingObject {
  return { id: 'd', anchors: [], options: {}, ...base, ...partial } as DrawingObject
}

const pt = (time: number, price: number) => ({ time, price })

describe('shapeGeometry', () => {
  it('extends a trend line to the right edge and labels its price change', () => {
    const d = drawing({
      type: 'trendline',
      anchors: [pt(0, 100), pt(10, 101)],
      options: { extendLeft: false, extendRight: true, showAngle: false, showPriceChange: true },
    } as Partial<DrawingObject> & { type: 'trendline' })
    const geo = shapeGeometry(
      d,
      [
        { x: 40, y: 100 },
        { x: 80, y: 90 },
      ],
      ctx,
    )
    expect(geo.segments[0].to.x).toBe(400)
    expect(geo.labels[0].text).toBe('+1.00 (+1.00%)')
    expect(geo.handles).toEqual([
      { x: 40, y: 100 },
      { x: 80, y: 90 },
    ])
  })

  it('draws a horizontal line across the plot with its price on the right axis', () => {
    const d = drawing({ type: 'hline', anchors: [pt(0, 101.5)] })
    const geo = shapeGeometry(d, [{ x: -20, y: 85 }], ctx)
    expect(geo.segments[0]).toMatchObject({ from: { x: 0, y: 85 }, to: { x: 400, y: 85 } })
    expect(geo.labels).toEqual([{ x: 402, y: 89, text: '101.50', axis: 'right' }])
  })

  it('spans every pane with a vertical line and labels its time on the time axis', () => {
    const d = drawing({ type: 'vline', anchors: [pt(7, 100)] })
    const geo = shapeGeometry(d, [{ x: 120, y: 100 }], ctx)
    expect(geo.clip).toBe('chart')
    expect(geo.segments[0]).toMatchObject({ from: { x: 120, y: 0 }, to: { x: 120, y: 240 } })
    expect(geo.labels[0]).toMatchObject({ text: 't7', axis: 'bottom' })
  })

  it('builds a parallel channel whose third anchor sets the second edge', () => {
    const d = drawing({
      type: 'channel',
      anchors: [pt(0, 100), pt(10, 100), pt(0, 102)],
      options: { showMiddle: true, fill: true },
    } as Partial<DrawingObject> & { type: 'channel' })
    const geo = shapeGeometry(
      d,
      [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 0, y: 80 },
      ],
      ctx,
    )
    expect(geo.segments[1]).toMatchObject({ from: { x: 0, y: 80 }, to: { x: 100, y: 80 } })
    expect(geo.segments[2].guide).toBe(true)
    expect(geo.fills[0].points).toHaveLength(4)
    expect(geo.handles).toHaveLength(3)
  })

  it('draws only the enabled retracement levels, each with its price', () => {
    const d = drawing({
      type: 'fib',
      anchors: [pt(0, 100), pt(10, 110)],
      options: { levels: [0, 0.5, 1], extendRight: false },
    } as Partial<DrawingObject> & { type: 'fib' })
    const geo = shapeGeometry(
      d,
      [
        { x: 0, y: 100 },
        { x: 100, y: 0 },
      ],
      ctx,
    )
    // The guide between the anchors plus one line per enabled level.
    expect(geo.segments).toHaveLength(4)
    expect(geo.labels.map((label) => label.text)).toEqual([
      '0.0% 110.00',
      '50.0% 105.00',
      '100.0% 100.00',
    ])
  })

  it('projects extension levels from the third anchor by the first swing', () => {
    const d = drawing({
      type: 'fibext',
      anchors: [pt(0, 100), pt(10, 110), pt(20, 105)],
      options: { levels: [0, 1], extendRight: true },
    } as Partial<DrawingObject> & { type: 'fibext' })
    const geo = shapeGeometry(
      d,
      [
        { x: 0, y: 100 },
        { x: 100, y: 0 },
        { x: 200, y: 50 },
      ],
      ctx,
    )
    expect(geo.labels.map((label) => label.text)).toEqual(['0.0% 105.00', '100.0% 115.00'])
  })

  it('labels a long position with its target and stop in ticks, percent and reward-to-risk', () => {
    const d = drawing({
      type: 'position',
      anchors: [pt(0, 100), pt(10, 99), pt(20, 103)],
      options: { side: 'long' },
    } as Partial<DrawingObject> & { type: 'position' })
    const geo = shapeGeometry(
      d,
      [
        { x: 40, y: 100 },
        { x: 120, y: 110 },
        { x: 200, y: 70 },
      ],
      ctx,
    )
    const [entry, target, stop] = geo.labels
    expect(entry.text).toBe('Entry 100.00')
    expect(target.text).toBe('TP 103.00 · 300 ticks · +3.00% · R:R 3.00')
    expect(stop.text).toBe('SL 99.00 · 100 ticks · -1.00%')
  })

  it('reads a short position with the profit below entry', () => {
    const d = drawing({
      type: 'position',
      anchors: [pt(0, 100), pt(10, 101), pt(20, 98)],
      options: { side: 'short' },
    } as Partial<DrawingObject> & { type: 'position' })
    const geo = shapeGeometry(
      d,
      [
        { x: 40, y: 100 },
        { x: 120, y: 90 },
        { x: 200, y: 120 },
      ],
      ctx,
    )
    expect(geo.labels[1].text).toMatch(/^TP 98\.00 · 200 ticks · \+2\.00%/)
  })

  it('keeps a text note anchored at its point with its text', () => {
    const d = drawing({
      type: 'text',
      anchors: [pt(0, 100)],
      options: { text: 'breakout' },
    } as Partial<DrawingObject> & { type: 'text' })
    const geo = shapeGeometry(d, [{ x: 60, y: 100 }], ctx)
    expect(geo.labels).toEqual([{ x: 60, y: 100, text: 'breakout' }])
    expect(geo.handles).toEqual([{ x: 60, y: 100 }])
  })
})
