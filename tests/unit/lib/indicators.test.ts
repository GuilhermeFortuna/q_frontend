import { describe, expect, it } from 'vitest'

import { bollingerBands } from '@/lib/indicators/bollinger'
import { ema } from '@/lib/indicators/ema'
import { macd } from '@/lib/indicators/macd'
import { rsi } from '@/lib/indicators/rsi'
import { sma } from '@/lib/indicators/sma'
import type { OhlcvBar } from '@/types/api'

function makeBars(closes: number[]): OhlcvBar[] {
  return closes.map((close, i) => ({
    timestamp: new Date(Date.UTC(2024, 0, i + 1)).toISOString(),
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + i,
  }))
}

describe('sma', () => {
  it('returns null until period is reached', () => {
    const bars = makeBars([10, 11, 12, 13, 14])
    const result = sma(bars, 3)
    expect(result.slice(0, 2)).toEqual([null, null])
    expect(result[2]).toBeCloseTo(11)
    expect(result[4]).toBeCloseTo(13)
  })
})

describe('ema', () => {
  it('computes exponential moving average', () => {
    const bars = makeBars([10, 11, 12, 13, 14, 15])
    const result = ema(bars, 3)
    expect(result[0]).toBeNull()
    expect(result[2]).not.toBeNull()
    expect(result[5]).toBeGreaterThan(result[2]!)
  })
})

describe('rsi', () => {
  it('returns bounded oscillator values', () => {
    const bars = makeBars(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5))
    const result = rsi(bars, 14)
    const valid = result.filter((v): v is number => v !== null)
    expect(valid.length).toBeGreaterThan(0)
    valid.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    })
  })
})

describe('bollingerBands', () => {
  it('upper band is above lower band when defined', () => {
    const bars = makeBars(Array.from({ length: 25 }, (_, i) => 50 + Math.sin(i) * 2))
    const { upper, lower } = bollingerBands(bars, 20, 2)
    for (let i = 20; i < bars.length; i++) {
      expect(upper[i]).not.toBeNull()
      expect(lower[i]).not.toBeNull()
      expect(upper[i]!).toBeGreaterThan(lower[i]!)
    }
  })
})

describe('macd', () => {
  it('produces macd, signal, and histogram series', () => {
    const bars = makeBars(Array.from({ length: 40 }, (_, i) => 100 + i * 0.2))
    const { macd: macdLine, signal, histogram } = macd(bars, 12, 26, 9)
    expect(macdLine.some((v) => v !== null)).toBe(true)
    expect(signal.some((v) => v !== null)).toBe(true)
    expect(histogram.some((v) => v !== null)).toBe(true)
  })
})
