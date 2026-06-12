import { describe, expect, it } from 'vitest'

import {
  categoryLabel,
  paramHint,
  strategyCardDescription,
  strategyCategory,
  strategyThesis,
} from '@/lib/strategies/strategyPresentation'
import type { StrategyInfo } from '@/types/strategies'

const baseStrategy: StrategyInfo = {
  name: 'Test',
  label: 'Test Strategy',
  description: 'One-line description.',
  params: [{ name: 'period', label: 'Period', type: 'int', default: 14 }],
}

describe('strategyPresentation fallbacks', () => {
  it('defaults missing category to other', () => {
    expect(strategyCategory(baseStrategy)).toBe('other')
    expect(categoryLabel(strategyCategory(baseStrategy))).toBe('Other')
  })

  it('falls back thesis to description', () => {
    expect(strategyThesis(baseStrategy)).toBe('One-line description.')
    expect(strategyThesis({ ...baseStrategy, thesis: '  Full thesis.  ' })).toBe('Full thesis.')
  })

  it('uses description for card one-liner', () => {
    expect(strategyCardDescription(baseStrategy)).toBe('One-line description.')
  })

  it('returns null for missing param hints', () => {
    expect(paramHint({ hint: undefined })).toBeNull()
    expect(paramHint({ hint: '  ' })).toBeNull()
    expect(paramHint({ hint: 'Shorter = noisier.' })).toBe('Shorter = noisier.')
  })
})
