import { describe, expect, it } from 'vitest'

import { formatCurrency, formatSignedCurrency } from '@/components/backtests/chartUtils'

describe('chartUtils currency formatting', () => {
  it('formats large values with thousands separators', () => {
    expect(formatCurrency(1884703.5)).toBe('1,884,703.50')
  })

  it('formats signed currency with explicit sign', () => {
    expect(formatSignedCurrency(1884703.5)).toBe('+1,884,703.50')
    expect(formatSignedCurrency(-2500)).toBe('-2,500.00')
    expect(formatSignedCurrency(0)).toBe('0.00')
  })
})
