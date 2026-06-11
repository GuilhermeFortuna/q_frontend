import { describe, expect, it } from 'vitest'

import { formatPrice } from '@/lib/market/format'

describe('formatPrice', () => {
  it('formats with the requested number of digits', () => {
    expect(formatPrice(1234.5, 0)).toBe(
      (1234.5).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    )
    expect(formatPrice(41.08, 2)).toBe(
      (41.08).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
  })

  it('defaults to two decimal places', () => {
    expect(formatPrice(10)).toBe(
      (10).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
  })
})
