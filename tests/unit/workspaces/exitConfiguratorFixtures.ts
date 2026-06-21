import type { ExitRuleCatalogResponse, StrategyParamSpec } from '@/types/strategies'

export const mockExitParamSpecs: StrategyParamSpec[] = [
  {
    name: 'rule_a_enable',
    label: 'Rule A Mult',
    type: 'float',
    default: 0,
    min: 0,
    max: 10,
    step: 0.1,
    exit_group: 'stop_loss',
    hint: 'Rule A hint.',
  },
  {
    name: 'rule_a_offset',
    label: 'Rule A Offset',
    type: 'float',
    default: 0,
    min: 0,
    max: 1,
    step: 0.001,
    exit_group: 'stop_loss',
    hint: 'Rule A offset hint.',
  },
  {
    name: 'rule_b_enable',
    label: 'Rule B Mult',
    type: 'float',
    default: 0,
    min: 0,
    max: 10,
    step: 0.1,
    exit_group: 'trailing',
    hint: 'Rule B hint.',
  },
  {
    name: 'rule_c_enable',
    label: 'Rule C Bars',
    type: 'int',
    default: 0,
    min: 0,
    max: 100,
    step: 1,
    exit_group: 'time',
    hint: 'Rule C hint.',
  },
  {
    name: 'shared_indicator',
    label: 'Shared Indicator',
    type: 'int',
    default: 14,
    min: 2,
    max: 100,
    step: 1,
    exit_group: 'general',
    hint: 'Shared indicator hint.',
  },
]

export const mockExitCatalog: ExitRuleCatalogResponse = {
  exit_rules: [
    {
      id: 'rule_a',
      label: 'Rule A',
      description: 'First stop-loss rule.',
      exit_group: 'stop_loss',
      enable_param: 'rule_a_enable',
      param_names: ['rule_a_enable', 'rule_a_offset'],
      required_param_names: [],
    },
    {
      id: 'rule_b',
      label: 'Rule B',
      description: 'Trailing rule needing shared indicator.',
      exit_group: 'trailing',
      enable_param: 'rule_b_enable',
      param_names: ['rule_b_enable'],
      required_param_names: ['shared_indicator'],
    },
    {
      id: 'rule_c',
      label: 'Rule C',
      description: 'Time-based exit.',
      exit_group: 'time',
      enable_param: 'rule_c_enable',
      param_names: ['rule_c_enable'],
      required_param_names: [],
    },
  ],
  shared_exit_params: ['shared_indicator'],
  exit_presets: [
    {
      id: 'preset_ab',
      label: 'Preset A+B',
      description: 'Enable rule A and B together.',
      parameters: {
        rule_a_enable: 2,
        rule_b_enable: 3,
        shared_indicator: 21,
      },
    },
  ],
}

export const mockSavedStrategyParams: Record<string, number> = {
  rule_a_enable: 0,
  rule_a_offset: 0,
  rule_b_enable: 3,
  rule_c_enable: 0,
  shared_indicator: 14,
}
