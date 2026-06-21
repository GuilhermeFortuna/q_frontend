import { describe, expect, it, vi } from 'vitest'

import {
  defaultEnableValue,
  exitRuleEnableUpdate,
  toggleExitRuleParam,
} from '@/workspaces/strategy/exitRuleSemantics'
import type { StrategyParamSpec } from '@/types/strategies'
import { mockExitCatalog, mockExitParamSpecs } from './exitConfiguratorFixtures'

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

describe('exitRuleEnableUpdate', () => {
  const ruleA = mockExitCatalog.exit_rules.find((rule) => rule.id === 'rule_a')!
  const ruleB = mockExitCatalog.exit_rules.find((rule) => rule.id === 'rule_b')!

  it('returns zero when disabling a rule', () => {
    expect(exitRuleEnableUpdate(ruleA, false, mockExitParamSpecs)).toEqual({ rule_a_enable: 0 })
  })

  it('uses enable_value when positive', () => {
    expect(exitRuleEnableUpdate(ruleA, true, mockExitParamSpecs)).toEqual({ rule_a_enable: 2 })
    expect(exitRuleEnableUpdate(ruleB, true, mockExitParamSpecs)).toEqual({ rule_b_enable: 3 })
  })

  it('falls back to defaultEnableValue when enable_value is zero', () => {
    const ruleC = mockExitCatalog.exit_rules.find((rule) => rule.id === 'rule_c')!
    expect(exitRuleEnableUpdate(ruleC, true, mockExitParamSpecs)).toEqual({ rule_c_enable: 50 })
  })
})

describe('toggleExitRuleParam', () => {
  it('flips between on-baseline and zero via onChange', () => {
    const ruleB = mockExitCatalog.exit_rules.find((rule) => rule.id === 'rule_b')!
    const onChange = vi.fn()

    toggleExitRuleParam(ruleB, { rule_b_enable: 0 }, onChange, mockExitParamSpecs)
    expect(onChange).toHaveBeenCalledWith('rule_b_enable', 3)

    onChange.mockClear()
    toggleExitRuleParam(ruleB, { rule_b_enable: 3 }, onChange, mockExitParamSpecs)
    expect(onChange).toHaveBeenCalledWith('rule_b_enable', 0)
  })
})
