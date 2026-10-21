import { describe, expect, it } from 'vitest'

import {
  decimalPlaces,
  formatPrice,
  inferDigits,
  resolvePriceFormat,
  snapToTick,
} from '@/lib/market/priceFormat'

describe('decimalPlaces and inferDigits', () => {
  it('counts decimals and ignores binary float noise', () => {
    expect(decimalPlaces(101)).toBe(0)
    expect(decimalPlaces(101.5)).toBe(1)
    expect(decimalPlaces(100.1 + 0.2)).toBe(1)
    expect(decimalPlaces(0.000012)).toBe(6)
  })

  it('takes the widest precision among the values and caps it at six digits', () => {
    expect(inferDigits([100, 100.25, 99.5])).toBe(2)
    expect(inferDigits([1.234567891])).toBe(6)
    expect(inferDigits([])).toBe(0)
  })
})

describe('resolvePriceFormat', () => {
  const bars = [{ close: 10.5 }, { close: 11.25 }]

  it('prefers instrument info for digits and tick size', () => {
    expect(
      resolvePriceFormat({
        instrument: { digits: 5, tickSize: 0.00001 },
        snapshotDigits: 3,
        bars,
      }),
    ).toEqual({ digits: 5, tickSize: 0.00001 })
  })

  it('falls back to the snapshot digits, deriving the tick size from them', () => {
    expect(resolvePriceFormat({ snapshotDigits: 3, bars })).toEqual({
      digits: 3,
      tickSize: 0.001,
    })
  })

  it('infers precision from the loaded closes for LOCAL symbols without instrument info', () => {
    expect(resolvePriceFormat({ bars })).toEqual({ digits: 2, tickSize: 0.01 })
    expect(resolvePriceFormat({ bars: [{ close: 3 }] })).toEqual({ digits: 0, tickSize: 1 })
  })

  it('uses two digits when nothing is known', () => {
    expect(resolvePriceFormat({ bars: [] })).toEqual({ digits: 2, tickSize: 0.01 })
  })

  it('ignores an invalid tick size and digit count', () => {
    expect(
      resolvePriceFormat({ instrument: { digits: 2, tickSize: 0 }, snapshotDigits: 9, bars }),
    ).toEqual({ digits: 2, tickSize: 0.01 })
  })
})

describe('formatPrice and snapToTick', () => {
  it('formats at the requested precision', () => {
    expect(formatPrice(1234.5678, 0)).toBe('1235')
    expect(formatPrice(1234.5678, 2)).toBe('1234.57')
    expect(formatPrice(1.23456789, 5)).toBe('1.23457')
  })

  it('rounds to the nearest tick at the requested precision', () => {
    expect(snapToTick(100.236, 0.05, 2)).toBe(100.25)
    expect(snapToTick(100.012, 0.01, 2)).toBe(100.01)
    expect(snapToTick(5.123456, 0, 4)).toBe(5.1235)
  })
})
