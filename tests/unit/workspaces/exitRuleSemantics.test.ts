import { describe, expect, it } from 'vitest'

import { defaultEnableValue } from '@/workspaces/strategy/exitRuleSemantics'
import type { StrategyParamSpec } from '@/types/strategies'

describe('defaultEnableValue', () => {
  it('uses a positive spec default when present', () => {
    const spec: StrategyParamSpec = {
      name: 'enable_param',
      label: 'Enable',
      type: 'float',
      default: 0.02,
      min: 0,
      max: 1,
      step: 0.001,
    }
    expect(defaultEnableValue(spec)).toBe(0.02)
  })

  it('falls back to the midpoint when the default is zero', () => {
    const intSpec: StrategyParamSpec = {
      name: 'bars',
      label: 'Bars',
      type: 'int',
      default: 0,
      min: 0,
      max: 100,
      step: 1,
    }
    expect(defaultEnableValue(intSpec)).toBe(50)

    const floatSpec: StrategyParamSpec = {
      name: 'mult',
      label: 'Mult',
      type: 'float',
      default: 0,
      min: 0,
      max: 10,
      step: 0.1,
    }
    expect(defaultEnableValue(floatSpec)).toBe(5)
  })
})
