import { endOfDay, startOfDay } from 'date-fns'

import type { RiskMode } from '@/components/optimize/optimizeFormShared'
import type { MaType } from '@/lib/backtesting/maTypes'
import type {
  CategoricalParam,
  FloatParam,
  IntParam,
  LogFloatParam,
  ObjectiveMode,
  OptimizationConfig,
  Sampler,
  SearchParam,
} from '@/types/optimization'

export type OptimizeFormHydration = {
  symbol: string
  timeframe: string
  startDate: Date
  endDate: Date
  capital: number
  pointValue: number
  objective: ObjectiveMode
  sampler: Sampler
  nTrials: number
  seed: number
  pruner: 'none' | 'median' | 'hyperband'
  continueOnTrialError: boolean
  shortLow: number
  shortHigh: number
  longLow: number
  longHigh: number
  thresholdLow: number
  thresholdHigh: number
  shortMaChoices: MaType[]
  longMaChoices: MaType[]
  riskMode: RiskMode
  qtyLow: number
  qtyHigh: number
  marginLow: number
  marginHigh: number
  minContractsLow: number
  minContractsHigh: number
}

function readIntRange(param: SearchParam | undefined): [number, number] | null {
  if (param?.type === 'int') return [param.low, param.high]
  return null
}

function readFloatRange(param: SearchParam | undefined): [number, number] | null {
  if (param?.type === 'float') return [param.low, param.high]
  return null
}

function readLogFloatRange(param: SearchParam | undefined): [number, number] | null {
  if (param?.type === 'log-float') return [param.low, param.high]
  return null
}

function readChoices(param: SearchParam | undefined): MaType[] | null {
  if (param?.type !== 'categorical') return null
  return param.choices.map(String) as MaType[]
}

function readRiskMode(riskParams: Record<string, SearchParam>): RiskMode {
  const typeParam = riskParams.type as CategoricalParam | undefined
  const choice = typeParam?.choices?.[0]
  return choice === 'fixed_safety_margin' ? 'fixed_safety_margin' : 'fixed_quantity'
}

export function hydrateOptimizeFormFromConfig(config: OptimizationConfig): OptimizeFormHydration {
  const strategyParams = config.search_space.strategy_params
  const riskParams = config.search_space.risk_params
  const riskMode = readRiskMode(riskParams)

  const shortRange = readIntRange(strategyParams.short_period as IntParam | undefined) ?? [5, 30]
  const longRange = readIntRange(strategyParams.long_period as IntParam | undefined) ?? [31, 100]
  const thresholdRange = readFloatRange(strategyParams.threshold as FloatParam | undefined) ?? [
    0, 2,
  ]

  const qtyRange = readFloatRange(riskParams.quantity as FloatParam | undefined) ?? [1, 3]
  const marginRange = readLogFloatRange(
    riskParams.safety_margin_per_contract as LogFloatParam | undefined,
  ) ?? [1000, 10000]
  const minContractsRange = readIntRange(riskParams.min_contracts as IntParam | undefined) ?? [1, 3]

  return {
    symbol: config.backtest.symbol,
    timeframe: config.backtest.timeframe,
    startDate: startOfDay(new Date(config.backtest.start)),
    endDate: endOfDay(new Date(config.backtest.end)),
    capital: config.backtest.initial_capital,
    pointValue: config.backtest.point_value,
    objective: config.objective.mode,
    sampler: config.study.sampler ?? 'tpe',
    nTrials: config.study.n_trials,
    seed: config.study.seed ?? 42,
    pruner: config.study.pruner ?? 'none',
    continueOnTrialError: config.study.continue_on_trial_error ?? false,
    shortLow: shortRange[0],
    shortHigh: shortRange[1],
    longLow: longRange[0],
    longHigh: longRange[1],
    thresholdLow: thresholdRange[0],
    thresholdHigh: thresholdRange[1],
    shortMaChoices: readChoices(strategyParams.short_ma_type) ?? ['sma'],
    longMaChoices: readChoices(strategyParams.long_ma_type) ?? ['sma'],
    riskMode,
    qtyLow: qtyRange[0],
    qtyHigh: qtyRange[1],
    marginLow: marginRange[0],
    marginHigh: marginRange[1],
    minContractsLow: minContractsRange[0],
    minContractsHigh: minContractsRange[1],
  }
}
