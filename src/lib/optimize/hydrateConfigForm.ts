import { endOfDay, startOfDay } from 'date-fns'

import type { RiskMode } from '@/components/optimize/optimizeFormShared'
import {
  defaultSearchSpaceFromSpecs,
  hydrateSearchSpaceFromPayload,
  type SearchSpaceFieldState,
} from '@/lib/strategies/strategyParams'
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
import type { StrategyInfo } from '@/types/strategies'

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
  strategy: string
  strategySearchSpace: Record<string, SearchSpaceFieldState>
  riskMode: RiskMode
  qtyLow: number
  qtyHigh: number
  marginLow: number
  marginHigh: number
  minContractsLow: number
  minContractsHigh: number
  dayTrade: boolean
  dayTradeStartTime: string
  dayTradeEndTime: string
  dayTradeCloseTime: string
  engine: 'candle' | 'tick'
  displayTimeframe: string
  tickFlags: 'all' | 'trade'
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

function readRiskMode(riskParams: Record<string, SearchParam>): RiskMode {
  const typeParam = riskParams.type as CategoricalParam | undefined
  const choice = typeParam?.choices?.[0]
  return choice === 'fixed_safety_margin' ? 'fixed_safety_margin' : 'fixed_quantity'
}

function resolveStrategyInfo(
  strategies: StrategyInfo[],
  strategyName: string,
): StrategyInfo | undefined {
  return strategies.find((entry) => entry.name === strategyName)
}

export function hydrateOptimizeFormFromConfig(
  config: OptimizationConfig,
  strategies: StrategyInfo[] = [],
): OptimizeFormHydration {
  const strategyParams = config.search_space.strategy_params
  const riskParams = config.search_space.risk_params
  const riskMode = readRiskMode(riskParams)
  const strategyName = config.backtest.strategy

  const strategyInfo = resolveStrategyInfo(strategies, strategyName)
  const strategySearchSpace = strategyInfo
    ? hydrateSearchSpaceFromPayload(strategyParams, strategyInfo.params)
    : hydrateSearchSpaceFromPayload(strategyParams, [])

  const qtyRange = readFloatRange(riskParams.quantity as FloatParam | undefined) ?? [1, 3]
  const marginRange = readLogFloatRange(
    riskParams.safety_margin_per_contract as LogFloatParam | undefined,
  ) ?? [1000, 10000]
  const minContractsRange = readIntRange(riskParams.min_contracts as IntParam | undefined) ?? [1, 3]

  return {
    symbol: config.backtest.symbol,
    timeframe: config.backtest.timeframe ?? 'D1',
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
    strategy: strategyName,
    strategySearchSpace:
      Object.keys(strategySearchSpace).length > 0
        ? strategySearchSpace
        : defaultSearchSpaceFromSpecs(strategyInfo?.params ?? []),
    riskMode,
    qtyLow: qtyRange[0],
    qtyHigh: qtyRange[1],
    marginLow: marginRange[0],
    marginHigh: marginRange[1],
    minContractsLow: minContractsRange[0],
    minContractsHigh: minContractsRange[1],
    dayTrade: config.backtest.day_trade ?? false,
    dayTradeStartTime: config.backtest.day_trade_start_time ?? '09:00',
    dayTradeEndTime: config.backtest.day_trade_end_time ?? '16:00',
    dayTradeCloseTime: config.backtest.day_trade_close_time ?? '17:00',
    engine: config.backtest.engine ?? 'candle',
    displayTimeframe: config.backtest.display_timeframe ?? 'M1',
    tickFlags:
      config.backtest.tick_flags === 'trade' || config.backtest.tick_flags === 'all'
        ? config.backtest.tick_flags
        : 'all',
  }
}
