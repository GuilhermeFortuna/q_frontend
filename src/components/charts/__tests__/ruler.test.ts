import { describe, expect, it } from 'vitest'
import { formatRulerDuration, measureRuler } from '@/components/charts/ruler'
import { processBars } from '@/components/charts/hooks/useChartScales'
import type { OhlcvBar } from '@/types/api'

const HOUR_MS = 3_600_000
const bars: OhlcvBar[] = [0, 1, 2, 3, 4].map((i) => ({
  timestamp: new Date(Date.UTC(2026, 0, 5, 10) + i * HOUR_MS).toISOString(),
  open: 100,
  high: 101,
  low: 99,
  close: 100 + i,
  volume: 1,
}))
const processed = processBars(bars)

describe('measureRuler', () => {
  it('reports price delta, percent, candle count and duration between two points', () => {
    const measurement = measureRuler(
      { timestamp: bars[1].timestamp, price: 100 },
      { timestamp: bars[4].timestamp, price: 105 },
      processed,
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
      { timestamp: bars[4].timestamp, price: 110 },
      { timestamp: bars[2].timestamp, price: 99 },
      processed,
    )

    expect(measurement?.bars).toBe(2)
    expect(measurement?.priceDelta).toBe(-11)
    expect(measurement?.percentDelta).toBeCloseTo(-10)
  })

  it('returns null when a point is not on a known bar', () => {
    expect(
      measureRuler(
        { timestamp: '1999-01-01T00:00:00.000Z', price: 1 },
        { timestamp: bars[0].timestamp, price: 2 },
        processed,
      ),
    ).toBeNull()
  })

  it('reports zero percent when the start price is zero', () => {
    const measurement = measureRuler(
      { timestamp: bars[0].timestamp, price: 0 },
      { timestamp: bars[1].timestamp, price: 3 },
      processed,
    )
    expect(measurement?.percentDelta).toBe(0)
  })
})

describe('formatRulerDuration', () => {
  it('uses the largest two units', () => {
    expect(formatRulerDuration(45 * 60_000)).toBe('45m')
    expect(formatRulerDuration(3 * HOUR_MS + 20 * 60_000)).toBe('3h 20m')
    expect(formatRulerDuration(5 * 86_400_000 + 4 * HOUR_MS)).toBe('5d 4h')
  })
})
