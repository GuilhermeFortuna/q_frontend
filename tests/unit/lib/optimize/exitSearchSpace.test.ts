import { describe, expect, it } from 'vitest'

import {
  buildEnabledExitParamSpecs,
  buildStrategyParamsSearchSpacePayload,
  filterApplicableExitRules,
  initialEnabledExitRuleIds,
  pinEnableParamSearchParam,
} from '@/lib/optimize/exitSearchSpace'
import { defaultSearchSpaceFromSpecs } from '@/lib/strategies/strategyParams'
import { withResolvedCustomStrategyParams } from '@/lib/strategies/resolveCustomStrategyParams'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'
import { mockExitCatalog, mockExitParamSpecs } from '../../workspaces/exitConfiguratorFixtures'
import {
  mockOptimizeCustomSaved,
  mockOptimizeCustomStrategy,
  strategiesWithCustomCustom,
} from '../../fixtures/optimizeCustomStrategyFixtures'

describe('exitSearchSpace helpers', () => {
  it('filterApplicableExitRules excludes rules whose enable param is not on the strategy', () => {
    const applicable = filterApplicableExitRules(mockExitCatalog.exit_rules, mockExitParamSpecs)
    expect(applicable.map((rule) => rule.id)).toEqual(['rule_a', 'rule_b', 'rule_c'])
  })

  it('initialEnabledExitRuleIds selects rules whose enable default is greater than zero', () => {
    const specsWithDefaultOn = mockExitParamSpecs.map((spec) =>
      spec.name === 'rule_b_enable' ? { ...spec, default: 3 } : spec,
    )
    const enabled = initialEnabledExitRuleIds(mockExitCatalog.exit_rules, specsWithDefaultOn)
    expect([...enabled]).toEqual(['rule_b'])
  })

  it('buildEnabledExitParamSpecs includes shared params required by enabled rules', () => {
    const enabledRules = mockExitCatalog.exit_rules.filter((rule) => rule.id === 'rule_b')
    const specs = buildEnabledExitParamSpecs(
      enabledRules,
      mockExitParamSpecs,
      mockExitCatalog.shared_exit_params,
    )
    expect(specs.map((spec) => spec.name)).toEqual(['shared_indicator'])
  })

  it('pins disabled exits to zero and enabled exits to their on-value', () => {
    const ruleA = mockExitCatalog.exit_rules.find((rule) => rule.id === 'rule_a')!
    const ruleB = mockExitCatalog.exit_rules.find((rule) => rule.id === 'rule_b')!

    expect(pinEnableParamSearchParam(ruleA, true, mockExitParamSpecs)).toEqual({
      type: 'float',
      low: 2,
      high: 2,
      step: null,
    })
    expect(pinEnableParamSearchParam(ruleB, false, mockExitParamSpecs)).toEqual({
      type: 'float',
      low: 0,
      high: 0,
      step: null,
    })
  })

  it('buildStrategyParamsSearchSpacePayload includes entry params and enabled exit ranges', () => {
    const { entryParamSpecs, exitParamSpecs } = partitionStrategyParamSpecs(mockExitParamSpecs)
    const searchSpace = defaultSearchSpaceFromSpecs(mockExitParamSpecs)
    const enabledIds = new Set(['rule_a'])

    const payload = buildStrategyParamsSearchSpacePayload(
      searchSpace,
      entryParamSpecs,
      exitParamSpecs,
      mockExitCatalog.exit_rules,
      enabledIds,
      mockExitCatalog.shared_exit_params,
    )

    expect(payload.rule_a_offset).toMatchObject({ type: 'float' })
    expect(payload.rule_a_enable).toEqual({ type: 'float', low: 2, high: 2, step: null })
    expect(payload.rule_b_enable).toEqual({ type: 'float', low: 0, high: 0, step: null })
    expect(payload.rule_c_enable).toEqual({ type: 'int', low: 0, high: 0, step: 1 })
    expect(payload.rule_b_offset).toBeUndefined()
  })

  it('buildStrategyParamsSearchSpacePayload works for a resolved custom strategy', () => {
    const strategies = strategiesWithCustomCustom().strategies
    const selected = withResolvedCustomStrategyParams(mockOptimizeCustomStrategy, strategies, [
      mockOptimizeCustomSaved,
    ])
    const { entryParamSpecs, exitParamSpecs } = partitionStrategyParamSpecs(selected.params)
    const applicable = filterApplicableExitRules(
      [
        {
          id: 'fixed_sl',
          label: 'Fixed Stop Loss',
          description: 'Fixed stop.',
          exit_group: 'stop_loss',
          enable_param: 'stop_loss_pct',
          enable_value: 0.02,
          param_names: ['stop_loss_pct'],
          required_param_names: [],
        },
        {
          id: 'trailing_pct',
          label: 'Trailing Stop',
          description: 'Trailing stop.',
          exit_group: 'trailing',
          enable_param: 'trailing_stop_pct',
          enable_value: 0.015,
          param_names: ['trailing_stop_pct'],
          required_param_names: [],
        },
      ],
      exitParamSpecs,
    )
    const searchSpace = defaultSearchSpaceFromSpecs(selected.params)
    const enabledIds = new Set(['trailing_pct'])

    const payload = buildStrategyParamsSearchSpacePayload(
      searchSpace,
      entryParamSpecs,
      exitParamSpecs,
      applicable,
      enabledIds,
      [],
    )

    expect(payload.short_period).toMatchObject({ type: 'int' })
    expect(payload.trailing_stop_pct).toEqual({
      type: 'float',
      low: 0.015,
      high: 0.015,
      step: null,
    })
    expect(payload.stop_loss_pct).toEqual({ type: 'float', low: 0, high: 0, step: null })
  })
})
