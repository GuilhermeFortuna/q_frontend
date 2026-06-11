export type StrategyParamType = 'int' | 'float' | 'categorical'

export type StrategyParamSpec = {
  name: string
  label: string
  type: StrategyParamType
  default: number | string
  min?: number | null
  max?: number | null
  step?: number | null
  choices?: string[] | null
}

export type StrategyInfo = {
  name: string
  label: string
  description: string
  params: StrategyParamSpec[]
  engine?: 'candle' | 'tick'
}

export type StrategiesResponse = {
  strategies: StrategyInfo[]
}
