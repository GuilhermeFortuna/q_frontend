export type StrategyParamType = 'int' | 'float' | 'categorical'

export type StrategyCategory = 'trend' | 'mean_reversion' | 'breakout' | 'momentum' | 'other'

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
