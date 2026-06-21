export type StrategyParamType = 'int' | 'float' | 'categorical'

export type StrategyCategory = 'trend' | 'mean_reversion' | 'breakout' | 'momentum' | 'other'

export type ExitGroup = 'stop_loss' | 'trailing' | 'target' | 'time' | 'general'

export type StrategyParamSpec = {
  name: string
  label: string
  type: StrategyParamType
  default: number | string
  min?: number | null
  max?: number | null
  step?: number | null
  choices?: string[] | null
  hint?: string | null
  exit_group?: ExitGroup | null
}

export type StrategyInfo = {
  name: string
  label: string
  description: string
  params: StrategyParamSpec[]
  engine?: 'candle' | 'tick'
  category?: StrategyCategory
  thesis?: string
  strong_in?: string
  weak_in?: string
}

export type StrategiesResponse = {
  strategies: StrategyInfo[]
}

export type CustomStrategy = {
  name: string
  base_strategy: string
  description?: string
  parameters: Record<string, number | string>
}

export type ExitRuleInfo = {
  id: string
  label: string
  description: string
  exit_group: ExitGroup
  enable_param: string
  enable_value: number
  param_names: string[]
  required_param_names: string[]
}

export type ExitPreset = {
  id: string
  label: string
  description: string
  parameters: Record<string, number>
}

export type ExitRuleCatalogResponse = {
  exit_rules: ExitRuleInfo[]
  shared_exit_params: string[]
  exit_presets: ExitPreset[]
}
