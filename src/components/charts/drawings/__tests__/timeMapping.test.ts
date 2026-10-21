import { describe, expect, it } from 'vitest'

import { createTimeMapper } from '@/components/charts/drawings/timeMapping'

const MIN = 60_000
const H1 = 60 * MIN
const T0 = Date.UTC(2026, 0, 5, 10)

const times = Array.from({ length: 10 }, (_, i) => T0 + i * H1)

function mapperFor(startIndex = 0, timeframeMs = H1, barTimes: number[] = times) {
  return createTimeMapper({
    times: barTimes,
    timeframeMs,
    startIndex,
    firstSlotX: 10,
    slotStep: 20,
    left: 8,
  })
}

describe('createTimeMapper', () => {
  it('puts a bar centre at its band centre and its open at the band edge', () => {
    const mapper = mapperFor()
    // Bar 3 is centred at x = left + firstSlotX + 3 * step; its open is half a band to the left.
    expect(mapper.xOfTime(times[3] + H1 / 2)).toBe(8 + 10 + 3 * 20)
    expect(mapper.xOfTime(times[3])).toBe(8 + 10 + 3 * 20 - 10)
  })

  it('round-trips instants inside the loaded bars', () => {
    const mapper = mapperFor()
    for (const time of [times[0], times[4] + 17 * MIN, times[9] + 30 * MIN]) {
      expect(mapper.timeOfX(mapper.xOfTime(time))).toBeCloseTo(time, 0)
    }
  })

  it('extrapolates before the first and after the last loaded bar instead of snapping', () => {
    const mapper = mapperFor()
    const before = mapper.xOfTime(times[0] - 3 * H1)
    const after = mapper.xOfTime(times[9] + 4 * H1)
    expect(before).toBeLessThan(mapper.xOfTime(times[0]) - 2 * 20)
    expect(after).toBeGreaterThan(mapper.xOfTime(times[9]) + 3 * 20)
    expect(mapper.timeOfX(after)).toBeCloseTo(times[9] + 4 * H1, 0)
  })

  it('keeps the spacing between instants when the viewport scrolls', () => {
    const wide = mapperFor(0)
    const scrolled = mapperFor(4)
    const instant = times[6] + 15 * MIN
    const wideSpan = wide.xOfTime(instant) - wide.xOfTime(times[4])
    const scrolledSpan = scrolled.xOfTime(instant) - scrolled.xOfTime(times[4])
    expect(scrolledSpan).toBeCloseTo(wideSpan, 6)
    expect(scrolled.timeOfX(scrolled.xOfTime(instant))).toBeCloseTo(instant, 0)
  })

  it('places one instant inside the containing bar on finer and coarser timeframes', () => {
    const instant = T0 + 2 * H1 + 40 * MIN
    const hourly = mapperFor(0, H1)
    const fine = Array.from({ length: 120 }, (_, i) => T0 + i * 5 * MIN)
    const finer = mapperFor(0, 5 * MIN, fine)
    const coarse = Array.from({ length: 5 }, (_, i) => T0 + i * 2 * H1)
    const coarser = mapperFor(0, 2 * H1, coarse)

    expect(hourly.positionOfTime(instant)).toBeCloseTo(2 + 40 / 60 - 0.5, 6)
    // 12:40 opens a five-minute bar exactly: its centre is half a bar later.
    expect(finer.positionOfTime(instant)).toBeCloseTo(32 - 0.5, 6)
    // The two-hour bar opening at 12:00 contains 12:40, a third of the way through it.
    expect(coarser.positionOfTime(instant)).toBeCloseTo(1 - 0.5 + 40 / 120, 6)

    for (const mapper of [hourly, finer, coarser]) {
      expect(mapper.timeOfX(mapper.xOfTime(instant))).toBeCloseTo(instant, 0)
    }
  })

  it('does not stretch the axis across a session gap', () => {
    const gapped = [T0, T0 + H1, T0 + 2 * H1, T0 + 24 * H1, T0 + 25 * H1]
    const mapper = mapperFor(0, H1, gapped)
    // The bar after the gap opens exactly where its predecessor closes, not 22 hours later.
    expect(mapper.positionOfTime(T0 + 24 * H1)).toBeCloseTo(2.5, 6)
  })

  it('returns NaN positions when there are no loaded bars', () => {
    const mapper = mapperFor(0, H1, [])
    expect(mapper.xOfTime(T0)).toBeNaN()
  })
})
