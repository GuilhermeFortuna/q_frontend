import { describe, expect, it } from 'vitest'
import { formatRulerDuration, measureRuler } from '@/components/charts/ruler'
import { createTimeMapper } from '@/components/charts/drawings/timeMapping'

const HOUR_MS = 3_600_000
const START = Date.UTC(2026, 0, 5, 10)
const times = [0, 1, 2, 3, 4].map((i) => START + i * HOUR_MS)
const positionOfTime = createTimeMapper({
  times,
  timeframeMs: HOUR_MS,
  startIndex: 0,
  firstSlotX: 0,
  slotStep: 1,
  left: 0,
}).positionOfTime

describe('measureRuler', () => {
  it('reports price delta, percent, candle count and duration between two anchors', () => {
    const measurement = measureRuler(
      { time: times[1], price: 100 },
      { time: times[4], price: 105 },
      positionOfTime,
    )

    expect(measurement).toEqual({
      priceDelta: 5,
      percentDelta: 5,
      bars: 3,
      durationMs: 3 * HOUR_MS,
    })
  })

  it('counts candles and reports a negative delta regardless of drag direction', () => {
    const measurement = measureRuler(
      { time: times[4], price: 110 },
      { time: times[2], price: 99 },
      positionOfTime,
    )

    expect(measurement.bars).toBe(2)
    expect(measurement.priceDelta).toBe(-11)
    expect(measurement.percentDelta).toBeCloseTo(-10)
  })

  it('counts candles between anchors that are off the loaded bars by extrapolation', () => {
    const measurement = measureRuler(
      { time: times[0] - 2 * HOUR_MS, price: 1 },
      { time: times[0] + HOUR_MS, price: 2 },
      positionOfTime,
    )
    expect(measurement.bars).toBe(3)
    expect(measurement.durationMs).toBe(3 * HOUR_MS)
  })

  it('reports zero percent when the start price is zero', () => {
    const measurement = measureRuler(
      { time: times[0], price: 0 },
      { time: times[1], price: 3 },
      positionOfTime,
    )
    expect(measurement.percentDelta).toBe(0)
  })
})

describe('formatRulerDuration', () => {
  it('uses the largest two units', () => {
    expect(formatRulerDuration(45 * 60_000)).toBe('45m')
    expect(formatRulerDuration(3 * HOUR_MS + 20 * 60_000)).toBe('3h 20m')
    expect(formatRulerDuration(5 * 86_400_000 + 4 * HOUR_MS)).toBe('5d 4h')
  })
})
