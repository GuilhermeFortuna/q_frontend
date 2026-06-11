import { describe, expect, it } from 'vitest'

import { computeDayRangeMarkerPosition } from '@/lib/market/dayRange'

describe('computeDayRangeMarkerPosition', () => {
  it('places the marker proportionally within the day range', () => {
    expect(computeDayRangeMarkerPosition(50, 40, 60)).toBe(50)
    expect(computeDayRangeMarkerPosition(40, 40, 60)).toBe(0)
    expect(computeDayRangeMarkerPosition(60, 40, 60)).toBe(100)
  })

  it('centers the marker when day high equals day low', () => {
    expect(computeDayRangeMarkerPosition(42, 42, 42)).toBe(50)
  })

  it('clamps the marker inside the track', () => {
    expect(computeDayRangeMarkerPosition(10, 40, 60)).toBe(0)
    expect(computeDayRangeMarkerPosition(90, 40, 60)).toBe(100)
  })
})
