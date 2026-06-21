import { describe, expect, it } from 'vitest'

import {
  buildCandidateExitParamSpecs,
  buildStrategyParamsSearchSpacePayload,
  filterApplicableExitRules,
  initialCandidateExitRuleIds,
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

  it('initialCandidateExitRuleIds selects rules whose enable default is greater than zero', () => {
    const specsWithDefaultOn = mockExitParamSpecs.map((spec) =>
      spec.name === 'rule_b_enable' ? { ...spec, default: 3 } : spec,
    )
    const candidates = initialCandidateExitRuleIds(mockExitCatalog.exit_rules, specsWithDefaultOn)
    expect([...candidates]).toEqual(['rule_b'])
  })

  it('buildCandidateExitParamSpecs includes enable params and shared params required by candidates', () => {
    const candidateRules = mockExitCatalog.exit_rules.filter((rule) => rule.id === 'rule_a')
    const specs = buildCandidateExitParamSpecs(
      candidateRules,
      mockExitParamSpecs,
      mockExitCatalog.shared_exit_params,
    )
    expect(specs.map((spec) => spec.name)).toEqual(['rule_a_enable', 'rule_a_offset'])
  })

  it('pins non-candidate exits to zero', () => {
    const ruleB = mockExitCatalog.exit_rules.find((rule) => rule.id === 'rule_b')!

    expect(pinEnableParamSearchParam(ruleB, mockExitParamSpecs)).toEqual({
      type: 'float',
      low: 0,
      high: 0,
      step: null,
    })
  })

  it('buildStrategyParamsSearchSpacePayload sweeps candidate enable params from zero', () => {
    const { entryParamSpecs, exitParamSpecs } = partitionStrategyParamSpecs(mockExitParamSpecs)
    const searchSpace = defaultSearchSpaceFromSpecs(mockExitParamSpecs)
    const candidateIds = new Set(['rule_a'])

    const payload = buildStrategyParamsSearchSpacePayload(
      searchSpace,
      entryParamSpecs,
      exitParamSpecs,
      mockExitCatalog.exit_rules,
      candidateIds,
      mockExitCatalog.shared_exit_params,
    )

    expect(payload.rule_a_offset).toMatchObject({ type: 'float' })
    expect(payload.rule_a_enable).toMatchObject({ type: 'float', low: 0, high: 10, step: 0.1 })
    if (payload.rule_a_enable?.type === 'float') {
      expect(payload.rule_a_enable.low).not.toBe(payload.rule_a_enable.high)
    }
    expect(payload.rule_b_enable).toEqual({ type: 'float', low: 0, high: 0, step: null })
    expect(payload.rule_c_enable).toEqual({ type: 'int', low: 0, high: 0, step: 1 })
    expect(payload.rule_b_offset).toBeUndefined()
  })

  it('buildStrategyParamsSearchSpacePayload gives two candidates independent enable ranges from zero', () => {
    const { entryParamSpecs, exitParamSpecs } = partitionStrategyParamSpecs(mockExitParamSpecs)
    const searchSpace = defaultSearchSpaceFromSpecs(mockExitParamSpecs)
    const candidateIds = new Set(['rule_a', 'rule_b'])

    const payload = buildStrategyParamsSearchSpacePayload(
      searchSpace,
      entryParamSpecs,
      exitParamSpecs,
      mockExitCatalog.exit_rules,
      candidateIds,
      mockExitCatalog.shared_exit_params,
    )

    expect(payload.rule_a_enable).toMatchObject({ type: 'float', low: 0 })
    if (payload.rule_a_enable?.type === 'float') {
      expect(payload.rule_a_enable.low).not.toBe(payload.rule_a_enable.high)
    }
    expect(payload.rule_b_enable).toMatchObject({ type: 'float', low: 0 })
    if (payload.rule_b_enable?.type === 'float') {
      expect(payload.rule_b_enable.low).not.toBe(payload.rule_b_enable.high)
    }
    expect(payload.rule_c_enable).toEqual({ type: 'int', low: 0, high: 0, step: 1 })
    expect(payload.shared_indicator).toMatchObject({ type: 'int' })
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
    const candidateIds = new Set(['trailing_pct'])

    const payload = buildStrategyParamsSearchSpacePayload(
      searchSpace,
      entryParamSpecs,
      exitParamSpecs,
      applicable,
      candidateIds,
      [],
    )

    expect(payload.short_period).toMatchObject({ type: 'int' })
    expect(payload.trailing_stop_pct).toMatchObject({
      type: 'float',
      low: 0,
      high: 0.1,
      step: 0.001,
    })
    if (payload.trailing_stop_pct?.type === 'float') {
      expect(payload.trailing_stop_pct.low).not.toBe(payload.trailing_stop_pct.high)
    }
    expect(payload.stop_loss_pct).toEqual({ type: 'float', low: 0, high: 0, step: null })
  })
})
