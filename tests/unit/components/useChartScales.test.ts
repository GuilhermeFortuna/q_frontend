import { describe, expect, it } from 'vitest'

import { applyPriceAxisTransform } from '@/components/charts/hooks/useChartScales'

describe('applyPriceAxisTransform', () => {
  it('scales the price domain around its center', () => {
    const domain = { min: 90, max: 110, span: 20 }

    const compressed = applyPriceAxisTransform(domain, 0, 0.5)
    expect(compressed).toEqual([95, 105])

    const stretched = applyPriceAxisTransform(domain, 0, 2)
    expect(stretched).toEqual([80, 120])
  })

  it('applies pan offset before scaling', () => {
    const domain = { min: 0, max: 100, span: 100 }

    const shifted = applyPriceAxisTransform(domain, 10, 1)
    expect(shifted).toEqual([10, 110])
  })
})
