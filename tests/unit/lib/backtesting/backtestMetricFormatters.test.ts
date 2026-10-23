import { describe, expect, it } from 'vitest'

import { formatHoldTime } from '@/lib/backtesting/backtestMetricFormatters'

describe('formatHoldTime', () => {
  it.each([
    [100800, '1d 4h'],
    [11520, '3h 12m'],
    [2700, '45m'],
    [null, '—'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatHoldTime(seconds)).toBe(expected)
  })
})
