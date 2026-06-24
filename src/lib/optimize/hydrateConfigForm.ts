import { endOfDay, startOfDay } from 'date-fns'

import type { RiskMode } from '@/components/optimize/optimizeFormShared'
import {
  createEntrySlotId,
  defaultEntryManager,
  type EntryInstanceState,
  type EntryManagerState,
} from '@/lib/backtesting/entryInstances'
import {
  hydrateTransactionCostFields,
  type TransactionCostFields,
} from '@/lib/backtesting/transactionCosts'
import {
  defaultEntrySearchSpaceFromSpecs,
  defaultExitSearchSpaceFromSpecs,
  hydrateEntrySearchSpacesFromPayload,
} from '@/lib/optimize/multiEntrySearchSpace'
import { isNamespacedMultiEntryPayload } from '@/lib/optimize/exitSearchSpace'
import { formatMaxWorkersForInput } from '@/lib/optimize/studyConfig'
import { withResolvedCustomStrategyParams } from '@/lib/strategies/resolveCustomStrategyParams'
import {
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
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

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
  maxWorkersInput: string
  strategy: string
  entries: EntryInstanceState[]
  entryManager: EntryManagerState
  entrySearchSpaces: Record<string, Record<string, SearchSpaceFieldState>>
  exitSearchSpace: Record<string, SearchSpaceFieldState>
  managerSearchSpace: Record<string, SearchSpaceFieldState>
  riskMode: RiskMode
  qtyLow: number
  qtyHigh: number
  marginLow: number
  marginHigh: number
  minContractsLow: number
  minContractsHigh: number
  targetVolLow: number
  targetVolHigh: number
  inverseMinContractsLow: number
  inverseMinContractsHigh: number
  inverseMaxContractsInput: string
  costFields: TransactionCostFields
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
  if (choice === 'fixed_safety_margin') return 'fixed_safety_margin'
  if (choice === 'inverse_volatility') return 'inverse_volatility'
  return 'fixed_quantity'
}

function readFixedIntParam(param: SearchParam | undefined): string {
  if (param?.type === 'int' && param.low === param.high) {
    return String(param.low)
  }
  return ''
}

function resolveStrategyInfo(
  strategies: StrategyInfo[],
  strategyName: string,
): StrategyInfo | undefined {
  return strategies.find((entry) => entry.name === strategyName)
}

function hydrateLegacySingleEntry(
  config: OptimizationConfig,
  strategies: StrategyInfo[],
): Pick<
  OptimizeFormHydration,
  'entries' | 'entryManager' | 'entrySearchSpaces' | 'exitSearchSpace' | 'managerSearchSpace'
> {
  const strategyParams = config.search_space.strategy_params
  const strategyName = config.backtest.strategy
  const strategyInfo = resolveStrategyInfo(strategies, strategyName)
  const resolved = strategyInfo
    ? withResolvedCustomStrategyParams(strategyInfo, strategies, [])
    : undefined
  const specs = resolved?.params ?? strategyInfo?.params ?? []
  const { entryParamSpecs, exitParamSpecs } = partitionStrategyParamSpecs(specs)

  const slotId = createEntrySlotId()
  const mergedSearchSpace = strategyInfo
    ? hydrateSearchSpaceFromPayload(strategyParams, strategyInfo.params)
    : hydrateSearchSpaceFromPayload(strategyParams, [])

  const entrySearchSpace: Record<string, SearchSpaceFieldState> = {}
  for (const spec of entryParamSpecs) {
    if (mergedSearchSpace[spec.name]) {
      entrySearchSpace[spec.name] = mergedSearchSpace[spec.name]
    }
  }

  const exitSearchSpace: Record<string, SearchSpaceFieldState> = {}
  for (const spec of exitParamSpecs) {
    if (mergedSearchSpace[spec.name]) {
      exitSearchSpace[spec.name] = mergedSearchSpace[spec.name]
    }
  }

  return {
    entries: [
      {
        slotId,
        strategy: strategyName,
        params: {},
      },
    ],
    entryManager: defaultEntryManager(),
    entrySearchSpaces: {
      [slotId]:
        Object.keys(entrySearchSpace).length > 0
          ? entrySearchSpace
          : defaultEntrySearchSpaceFromSpecs(specs),
    },
    exitSearchSpace:
      Object.keys(exitSearchSpace).length > 0
        ? exitSearchSpace
        : defaultExitSearchSpaceFromSpecs(specs),
    managerSearchSpace: {},
  }
}

function hydrateMultiEntry(
  config: OptimizationConfig,
  strategies: StrategyInfo[],
): Pick<
  OptimizeFormHydration,
  'entries' | 'entryManager' | 'entrySearchSpaces' | 'exitSearchSpace' | 'managerSearchSpace'
> {
  const backtestEntries = config.backtest.entries ?? []
  const entries: EntryInstanceState[] = backtestEntries.map((entry, index) => ({
    slotId: `slot-${index}`,
    strategy: entry.strategy,
    params: (entry.params ?? {}) as EntryInstanceState['params'],
  }))

  const entryManager: EntryManagerState = config.backtest.entry_manager
    ? {
        kind: config.backtest.entry_manager.kind as EntryManagerState['kind'],
        params: (config.backtest.entry_manager.params ?? {}) as EntryManagerState['params'],
      }
    : defaultEntryManager()

  const resolveSpecs = (strategyName: string) => {
    const info = resolveStrategyInfo(strategies, strategyName)
    if (!info) return []
    return withResolvedCustomStrategyParams(info, strategies, []).params
  }

  const entrySearchSpaces = hydrateEntrySearchSpacesFromPayload(
    entries,
    config.search_space.strategy_params,
    resolveSpecs,
  )

  const unionExitSpecs = new Map<string, StrategyInfo['params'][number]>()
  for (const entry of entries) {
    const specs = resolveSpecs(entry.strategy)
    for (const spec of partitionStrategyParamSpecs(specs).exitParamSpecs) {
      unionExitSpecs.set(spec.name, spec)
    }
  }
  const exitParamSpecs = Array.from(unionExitSpecs.values())
  const exitSearchSpace = hydrateSearchSpaceFromPayload(
    config.search_space.strategy_params,
    exitParamSpecs,
  )

  const managerSearchSpace = hydrateSearchSpaceFromPayload(
    config.search_space.manager_params ?? {},
    [],
  )

  return {
    entries,
    entryManager,
    entrySearchSpaces,
    exitSearchSpace,
    managerSearchSpace,
  }
}

export function hydrateOptimizeFormFromConfig(
  config: OptimizationConfig,
  strategies: StrategyInfo[] = [],
): OptimizeFormHydration {
  const riskParams = config.search_space.risk_params
  const riskMode = readRiskMode(riskParams)
  const strategyName = config.backtest.strategy

  const backtestEntries = config.backtest.entries ?? []
  const entryManager = config.backtest.entry_manager ?? defaultEntryManager()
  const entryState =
    backtestEntries.length > 0 &&
    isNamespacedMultiEntryPayload(
      backtestEntries.map((entry, index) => ({
        slotId: `slot-${index}`,
        strategy: entry.strategy,
        params: entry.params as EntryInstanceState['params'],
      })),
      entryManager,
    )
      ? hydrateMultiEntry(config, strategies)
      : hydrateLegacySingleEntry(config, strategies)

  const qtyRange = readFloatRange(riskParams.quantity as FloatParam | undefined) ?? [1, 3]
  const marginRange = readLogFloatRange(
    riskParams.safety_margin_per_contract as LogFloatParam | undefined,
  ) ?? [1000, 10000]
  const minContractsRange = readIntRange(riskParams.min_contracts as IntParam | undefined) ?? [1, 3]
  const targetVolRange = readFloatRange(
    riskParams.target_volatility_pct as FloatParam | undefined,
  ) ?? [5, 15]
  const inverseMinContractsRange =
    riskMode === 'inverse_volatility'
      ? (readIntRange(riskParams.min_contracts as IntParam | undefined) ?? [0, 2])
      : [0, 2]

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
    maxWorkersInput: formatMaxWorkersForInput(config.study.max_workers),
    strategy: strategyName,
    ...entryState,
    riskMode,
    qtyLow: qtyRange[0],
    qtyHigh: qtyRange[1],
    marginLow: marginRange[0],
    marginHigh: marginRange[1],
    minContractsLow: minContractsRange[0],
    minContractsHigh: minContractsRange[1],
    targetVolLow: targetVolRange[0],
    targetVolHigh: targetVolRange[1],
    inverseMinContractsLow: inverseMinContractsRange[0],
    inverseMinContractsHigh: inverseMinContractsRange[1],
    inverseMaxContractsInput: readFixedIntParam(riskParams.max_contracts),
    costFields: hydrateTransactionCostFields(config.backtest.costs),
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
