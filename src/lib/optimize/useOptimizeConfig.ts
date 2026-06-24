import { endOfDay, startOfDay } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useCustomStrategies } from '@/api/queries/customStrategies'
import { useExitRuleCatalog, useSignalManagers, useStrategies } from '@/api/queries/strategies'
import type { RiskMode } from '@/components/optimize/optimizeFormShared'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import {
  createEntrySlotId,
  defaultEntryManager,
  entryDefaultsFromSpecs,
  instanceCountByStrategy,
  toEntryManagerPayload,
  toEntryPayload,
  type EntryInstanceState,
  type EntryManagerState,
} from '@/lib/backtesting/entryInstances'
import {
  buildCostsPayload,
  defaultTransactionCostFields,
  validateTransactionCosts,
  type TransactionCostFields,
} from '@/lib/backtesting/transactionCosts'
import {
  buildManagerSearchSpacePayload,
  buildMultiEntryStrategyParamsSearchSpacePayload,
  buildStrategyParamsSearchSpacePayload,
  buildCandidateExitParamSpecs,
  filterApplicableExitRules,
  initialCandidateExitRuleIds,
  isNamespacedMultiEntryPayload,
} from '@/lib/optimize/exitSearchSpace'
import { hydrateOptimizeFormFromConfig } from '@/lib/optimize/hydrateConfigForm'
import {
  defaultEntrySearchSpaceFromSpecs,
  defaultExitSearchSpaceFromSpecs,
  mergeExitSearchSpaceDefaults,
} from '@/lib/optimize/multiEntrySearchSpace'
import { isMaxWorkersInputInvalid, withMaxWorkers } from '@/lib/optimize/studyConfig'
import { withResolvedCustomStrategyParams } from '@/lib/strategies/resolveCustomStrategyParams'
import { strategyEngine } from '@/lib/strategies/strategyPresentation'
import {
  defaultSearchSpaceFromSpecs,
  validateSearchSpace,
  type SearchSpaceFieldState,
} from '@/lib/strategies/strategyParams'
import { useAppStore } from '@/store/useAppStore'
import type { ObjectiveMode, OptimizationConfig, Sampler, SearchParam } from '@/types/optimization'
import type { CustomStrategy, StrategyParamSpec } from '@/types/strategies'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

const EMPTY_MANAGER_PARAM_SPECS: StrategyParamSpec[] = []
const EMPTY_CUSTOM_STRATEGIES: CustomStrategy[] = []

export type OptimizeEngine = 'candle' | 'tick'

export const DISPLAY_TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'H1'] as const

export type { EntryInstanceState, EntryManagerState } from '@/lib/backtesting/entryInstances'

export type OptimizeConfigFields = {
  symbol: string
  timeframe: string
  startDate: Date
  endDate: Date
  capital: number
  pointValue: number
  dayTrade: boolean
  dayTradeStartTime: string
  dayTradeEndTime: string
  dayTradeCloseTime: string
  engine: OptimizeEngine
  displayTimeframe: string
  tickFlags: 'all' | 'trade'
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
}

export type OptimizeConfigSetters = {
  setSymbol: (value: string) => void
  setTimeframe: (value: string) => void
  setStartDate: (value: Date) => void
  setEndDate: (value: Date) => void
  setCapital: (value: number) => void
  setPointValue: (value: number) => void
  setDayTrade: (value: boolean) => void
  setDayTradeStartTime: (value: string) => void
  setDayTradeEndTime: (value: string) => void
  setDayTradeCloseTime: (value: string) => void
  setEngine: (value: OptimizeEngine) => void
  setDisplayTimeframe: (value: string) => void
  setTickFlags: (value: 'all' | 'trade') => void
  setObjective: (value: ObjectiveMode) => void
  setSampler: (value: Sampler) => void
  setNTrials: (value: number) => void
  setSeed: (value: number) => void
  setPruner: (value: 'none' | 'median' | 'hyperband') => void
  setContinueOnTrialError: (value: boolean) => void
  setMaxWorkersInput: (value: string) => void
  setStrategy: (value: string) => void
  setRiskMode: (value: RiskMode) => void
  setQtyLow: (value: number) => void
  setQtyHigh: (value: number) => void
  setMarginLow: (value: number) => void
  setMarginHigh: (value: number) => void
  setMinContractsLow: (value: number) => void
  setMinContractsHigh: (value: number) => void
  setTargetVolLow: (value: number) => void
  setTargetVolHigh: (value: number) => void
  setInverseMinContractsLow: (value: number) => void
  setInverseMinContractsHigh: (value: number) => void
  setInverseMaxContractsInput: (value: string) => void
  setCostFields: React.Dispatch<React.SetStateAction<TransactionCostFields>>
  handleEngineChange: (nextEngine: OptimizeEngine) => void
  handleStrategyChange: (nextStrategy: string) => void
  addEntry: (strategyName: string) => void
  removeEntry: (slotId: string) => void
  setEntryManager: (manager: EntryManagerState) => void
  handleEntrySearchSpaceChange: (slotId: string, name: string, field: SearchSpaceFieldState) => void
  handleExitSearchSpaceChange: (name: string, field: SearchSpaceFieldState) => void
  handleManagerSearchSpaceChange: (name: string, field: SearchSpaceFieldState) => void
}

export type OptimizeConfigValidation = {
  dateRangeInvalid: boolean
  rangesInvalid: boolean
  costValidation: ReturnType<typeof validateTransactionCosts>
  formInvalid: boolean
  costErrors: Partial<Record<string, string>>
  isMultiObjective: boolean
}

export function buildOptimizationConfig(
  fields: OptimizeConfigFields,
  selectedStrategyName: string,
  options?: {
    entries?: EntryInstanceState[]
    entryManager?: EntryManagerState
    exitParams?: Record<string, unknown>
  },
): OptimizationConfig {
  const {
    symbol,
    engine,
    timeframe,
    startDate,
    endDate,
    capital,
    pointValue,
    riskMode,
    qtyLow,
    qtyHigh,
    marginLow,
    marginHigh,
    minContractsLow,
    minContractsHigh,
    targetVolLow,
    targetVolHigh,
    inverseMinContractsLow,
    inverseMinContractsHigh,
    inverseMaxContractsInput,
    costFields,
    dayTrade,
    dayTradeStartTime,
    dayTradeEndTime,
    dayTradeCloseTime,
    displayTimeframe,
    tickFlags,
    objective,
    sampler,
    nTrials,
    seed,
    pruner,
    continueOnTrialError,
    maxWorkersInput,
  } = fields

  const isMultiObjective = objective === 'multi_objective_return_drawdown'

  const riskParams: Record<string, SearchParam> =
    riskMode === 'fixed_quantity'
      ? {
          type: { type: 'categorical', choices: ['fixed_quantity'] },
          quantity: { type: 'float', low: qtyLow, high: qtyHigh },
        }
      : riskMode === 'fixed_safety_margin'
        ? {
            type: { type: 'categorical', choices: ['fixed_safety_margin'] },
            safety_margin_per_contract: { type: 'log-float', low: marginLow, high: marginHigh },
            min_contracts: { type: 'int', low: minContractsLow, high: minContractsHigh },
          }
        : {
            type: { type: 'categorical', choices: ['inverse_volatility'] },
            target_volatility_pct: { type: 'float', low: targetVolLow, high: targetVolHigh },
            min_contracts: {
              type: 'int',
              low: inverseMinContractsLow,
              high: inverseMinContractsHigh,
            },
            ...(inverseMaxContractsInput.trim() !== ''
              ? {
                  max_contracts: {
                    type: 'int',
                    low: Number(inverseMaxContractsInput),
                    high: Number(inverseMaxContractsInput),
                  },
                }
              : {}),
          }

  const costs = buildCostsPayload(costFields)
  const useMultiEntryPayload = options?.entries && options.entryManager

  return {
    study: withMaxWorkers(
      {
        name: `${symbol}_${objective}_${Date.now()}`,
        n_trials: nTrials,
        seed,
        pruner,
        continue_on_trial_error: continueOnTrialError,
        sampler: isMultiObjective ? 'nsgaii' : sampler,
      },
      maxWorkersInput,
    ),
    objective: { mode: objective },
    backtest: {
      symbol,
      ...(engine === 'candle' ? { timeframe } : {}),
      start: startOfDay(startDate).toISOString(),
      end: endOfDay(endDate).toISOString(),
      initial_capital: capital,
      point_value: pointValue,
      strategy: selectedStrategyName,
      ...(useMultiEntryPayload
        ? {
            entries: toEntryPayload(options.entries!),
            entry_manager: toEntryManagerPayload(options.entryManager!),
            exit_params: options.exitParams ?? {},
          }
        : {}),
      ...(costs ? { costs } : {}),
      day_trade: dayTrade,
      day_trade_start_time: dayTradeStartTime,
      day_trade_end_time: dayTradeEndTime,
      day_trade_close_time: dayTradeCloseTime,
      ...(engine === 'tick'
        ? {
            engine: 'tick' as const,
            display_timeframe: displayTimeframe,
            tick_flags: tickFlags,
          }
        : {}),
    },
    search_space: {
      strategy_params: {},
      risk_params: riskParams,
    },
  }
}

export function useOptimizeConfig() {
  const [symbol, setSymbol] = useState('PETR4')
  const [timeframe, setTimeframe] = useState('D1')
  const [startDate, setStartDate] = useState(defaultBacktestStart)
  const [endDate, setEndDate] = useState(defaultBacktestEnd)
  const [capital, setCapital] = useState(100000)
  const [pointValue, setPointValue] = useState(1.0)
  const [dayTrade, setDayTrade] = useState(false)
  const [dayTradeStartTime, setDayTradeStartTime] = useState('09:00')
  const [dayTradeEndTime, setDayTradeEndTime] = useState('16:00')
  const [dayTradeCloseTime, setDayTradeCloseTime] = useState('17:00')
  const [engine, setEngine] = useState<OptimizeEngine>('candle')
  const [displayTimeframe, setDisplayTimeframe] = useState('M1')
  const [tickFlags, setTickFlags] = useState<'all' | 'trade'>('all')

  const [objective, setObjective] = useState<ObjectiveMode>('maximize_return_drawdown')
  const [sampler, setSampler] = useState<Sampler>('tpe')
  const [nTrials, setNTrials] = useState(30)
  const [seed, setSeed] = useState(42)
  const [pruner, setPruner] = useState<'none' | 'median' | 'hyperband'>('none')
  const [continueOnTrialError, setContinueOnTrialError] = useState(false)
  const [maxWorkersInput, setMaxWorkersInput] = useState('')

  const [strategy, setStrategy] = useState('MACrossover')
  const [entries, setEntries] = useState<EntryInstanceState[]>([])
  const [entryManager, setEntryManager] = useState<EntryManagerState>(defaultEntryManager)
  const [entrySearchSpaces, setEntrySearchSpaces] = useState<
    Record<string, Record<string, SearchSpaceFieldState>>
  >({})
  const [exitSearchSpace, setExitSearchSpace] = useState<Record<string, SearchSpaceFieldState>>({})
  const [managerSearchSpace, setManagerSearchSpace] = useState<
    Record<string, SearchSpaceFieldState>
  >({})
  const [candidateExitRuleIds, setCandidateExitRuleIds] = useState<Set<string>>(() => new Set())

  const [riskMode, setRiskMode] = useState<RiskMode>('fixed_quantity')
  const [qtyLow, setQtyLow] = useState(1)
  const [qtyHigh, setQtyHigh] = useState(3)
  const [marginLow, setMarginLow] = useState(1000)
  const [marginHigh, setMarginHigh] = useState(10000)
  const [minContractsLow, setMinContractsLow] = useState(1)
  const [minContractsHigh, setMinContractsHigh] = useState(3)
  const [targetVolLow, setTargetVolLow] = useState(5)
  const [targetVolHigh, setTargetVolHigh] = useState(15)
  const [inverseMinContractsLow, setInverseMinContractsLow] = useState(0)
  const [inverseMinContractsHigh, setInverseMinContractsHigh] = useState(2)
  const [inverseMaxContractsInput, setInverseMaxContractsInput] = useState('')
  const [costFields, setCostFields] = useState(defaultTransactionCostFields)

  const { data: strategiesData, isLoading: strategiesLoading } = useStrategies()
  const { data: exitCatalog } = useExitRuleCatalog()
  const { data: signalManagersData } = useSignalManagers()
  const { data: customStrategiesData, isLoading: customStrategiesLoading } = useCustomStrategies()
  const customStrategies = customStrategiesData ?? EMPTY_CUSTOM_STRATEGIES
  const strategies = useMemo(() => strategiesData?.strategies ?? [], [strategiesData?.strategies])
  const customStrategyNames = useMemo(
    () => new Set(customStrategies.map((entry) => entry.name)),
    [customStrategies],
  )
  const filteredStrategies = useMemo(
    () => strategies.filter((entry) => strategyEngine(entry) === engine),
    [strategies, engine],
  )

  const installSingleEntry = useCallback(
    (
      strategyName: string,
      strategyInfo = strategies.find((entry) => entry.name === strategyName),
    ) => {
      if (!strategyInfo) return
      const resolved = withResolvedCustomStrategyParams(strategyInfo, strategies, customStrategies)
      const slotId = createEntrySlotId()
      setEntries([
        {
          slotId,
          strategy: strategyName,
          params: entryDefaultsFromSpecs(resolved.params),
        },
      ])
      setEntrySearchSpaces({
        [slotId]: defaultEntrySearchSpaceFromSpecs(resolved.params),
      })
      setExitSearchSpace(defaultExitSearchSpaceFromSpecs(resolved.params))
      setStrategy(strategyName)
    },
    [strategies, customStrategies],
  )

  const primaryEntryStrategy = useMemo(() => {
    const primaryName = entries[0]?.strategy ?? strategy
    const info = strategies.find((entry) => entry.name === primaryName)
    if (!info) return undefined
    return withResolvedCustomStrategyParams(info, strategies, customStrategies)
  }, [entries, strategy, strategies, customStrategies])

  const selectedStrategy = primaryEntryStrategy

  const resolveEntryParamSpecs = useCallback(
    (strategyName: string) => {
      const info = strategies.find((entry) => entry.name === strategyName)
      if (!info) return []
      const resolved = withResolvedCustomStrategyParams(info, strategies, customStrategies)
      return partitionStrategyParamSpecs(resolved.params).entryParamSpecs
    },
    [strategies, customStrategies],
  )

  const { entryParamSpecs, exitParamSpecs } = useMemo(() => {
    const exitSpecsByName = new Map<string, StrategyParamSpec>()
    for (const entry of entries) {
      const info = strategies.find((item) => item.name === entry.strategy)
      if (!info) continue
      const resolved = withResolvedCustomStrategyParams(info, strategies, customStrategies)
      const partitioned = partitionStrategyParamSpecs(resolved.params)
      for (const spec of partitioned.exitParamSpecs) {
        exitSpecsByName.set(spec.name, spec)
      }
    }

    const primaryPartition = partitionStrategyParamSpecs(primaryEntryStrategy?.params ?? [])
    if (exitSpecsByName.size === 0) {
      return primaryPartition
    }

    return {
      entryParamSpecs: primaryPartition.entryParamSpecs,
      exitParamSpecs: Array.from(exitSpecsByName.values()),
    }
  }, [entries, primaryEntryStrategy?.params, strategies, customStrategies])

  const applicableExitRules = useMemo(
    () => filterApplicableExitRules(exitCatalog?.exit_rules ?? [], exitParamSpecs),
    [exitCatalog?.exit_rules, exitParamSpecs],
  )
  const candidateExitRules = useMemo(
    () => applicableExitRules.filter((rule) => candidateExitRuleIds.has(rule.id)),
    [applicableExitRules, candidateExitRuleIds],
  )
  const candidateExitParamSpecs = useMemo(
    () =>
      buildCandidateExitParamSpecs(
        candidateExitRules,
        exitParamSpecs,
        exitCatalog?.shared_exit_params ?? [],
      ),
    [candidateExitRules, exitParamSpecs, exitCatalog?.shared_exit_params],
  )

  const managerParamSpecs = useMemo(() => {
    const manager = signalManagersData?.managers.find((entry) => entry.id === entryManager.kind)
    return manager?.params ?? EMPTY_MANAGER_PARAM_SPECS
  }, [signalManagersData?.managers, entryManager.kind])

  const entryInstancesKey = useMemo(
    () => entries.map((entry) => `${entry.slotId}:${entry.strategy}`).join('|'),
    [entries],
  )

  const exitSpecNamesKey = useMemo(
    () => exitParamSpecs.map((spec) => spec.name).join(','),
    [exitParamSpecs],
  )

  const applicableExitRuleIdsKey = useMemo(
    () => applicableExitRules.map((rule) => rule.id).join(','),
    [applicableExitRules],
  )

  const searchSpaceInitialized = useRef(false)

  const pendingOptimizationConfig = useAppStore((s) => s.pendingOptimizationConfig)
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)

  useEffect(() => {
    if (strategies.length === 0 || searchSpaceInitialized.current) return
    const pool = strategies.filter((entry) => strategyEngine(entry) === engine)
    const info = pool.find((entry) => entry.name === strategy) ?? pool[0]
    if (!info) return
    if (!pool.some((entry) => entry.name === strategy)) {
      installSingleEntry(info.name, info)
    } else {
      installSingleEntry(strategy, info)
    }
    searchSpaceInitialized.current = true
  }, [strategies, strategy, engine, installSingleEntry])

  useEffect(() => {
    setCandidateExitRuleIds(initialCandidateExitRuleIds(applicableExitRules, exitParamSpecs))
    // Reset candidates when entry instances or applicable exit specs change.
  }, [entryInstancesKey, exitSpecNamesKey, applicableExitRuleIdsKey])

  useEffect(() => {
    if (entryManager.kind !== 'majority') return
    if (managerParamSpecs.length === 0) return
    setManagerSearchSpace((current) =>
      Object.keys(current).length > 0 ? current : defaultSearchSpaceFromSpecs(managerParamSpecs),
    )
  }, [entryManager.kind, managerParamSpecs])

  const setEntryManagerState = useCallback((manager: EntryManagerState) => {
    setEntryManager(manager)
    if (manager.kind !== 'majority') {
      setManagerSearchSpace({})
    }
  }, [])

  const toggleExitRule = (ruleId: string) => {
    setCandidateExitRuleIds((current) => {
      const next = new Set(current)
      if (next.has(ruleId)) {
        next.delete(ruleId)
      } else {
        next.add(ruleId)
      }
      return next
    })
  }

  useEffect(() => {
    if (!pendingOptimizationConfig) return
    const hydrated = hydrateOptimizeFormFromConfig(pendingOptimizationConfig, strategies)

    setSymbol(hydrated.symbol)
    setTimeframe(hydrated.timeframe)
    setStartDate(hydrated.startDate)
    setEndDate(hydrated.endDate)
    setCapital(hydrated.capital)
    setPointValue(hydrated.pointValue)
    setObjective(hydrated.objective)
    setSampler(hydrated.sampler)
    setNTrials(hydrated.nTrials)
    setSeed(hydrated.seed)
    setPruner(hydrated.pruner)
    setContinueOnTrialError(hydrated.continueOnTrialError)
    setMaxWorkersInput(hydrated.maxWorkersInput)
    setStrategy(hydrated.strategy)
    setEntries(hydrated.entries)
    setEntryManager(hydrated.entryManager)
    setEntrySearchSpaces(hydrated.entrySearchSpaces)
    setExitSearchSpace(hydrated.exitSearchSpace)
    setManagerSearchSpace(hydrated.managerSearchSpace)
    setRiskMode(hydrated.riskMode)
    setQtyLow(hydrated.qtyLow)
    setQtyHigh(hydrated.qtyHigh)
    setMarginLow(hydrated.marginLow)
    setMarginHigh(hydrated.marginHigh)
    setMinContractsLow(hydrated.minContractsLow)
    setMinContractsHigh(hydrated.minContractsHigh)
    setTargetVolLow(hydrated.targetVolLow)
    setTargetVolHigh(hydrated.targetVolHigh)
    setInverseMinContractsLow(hydrated.inverseMinContractsLow)
    setInverseMinContractsHigh(hydrated.inverseMinContractsHigh)
    setInverseMaxContractsInput(hydrated.inverseMaxContractsInput)
    setCostFields(hydrated.costFields)
    setDayTrade(hydrated.dayTrade)
    setDayTradeStartTime(hydrated.dayTradeStartTime)
    setDayTradeEndTime(hydrated.dayTradeEndTime)
    setDayTradeCloseTime(hydrated.dayTradeCloseTime)
    setEngine(hydrated.engine)
    setDisplayTimeframe(hydrated.displayTimeframe)
    setTickFlags(hydrated.tickFlags)
    searchSpaceInitialized.current = true

    setPendingOptimizationConfig(null)
  }, [pendingOptimizationConfig, setPendingOptimizationConfig, strategies])

  const handleEngineChange = (nextEngine: OptimizeEngine) => {
    setEngine(nextEngine)
    const pool = strategies.filter((entry) => strategyEngine(entry) === nextEngine)
    if (pool.length === 0) return
    const currentValid = entries.some((entry) => pool.some((item) => item.name === entry.strategy))
    if (!currentValid) {
      installSingleEntry(pool[0].name, pool[0])
    }
  }

  const handleStrategyChange = (nextStrategy: string) => {
    const info = strategies.find((entry) => entry.name === nextStrategy)
    installSingleEntry(nextStrategy, info)
  }

  const addEntry = useCallback(
    (strategyName: string) => {
      const info = strategies.find((entry) => entry.name === strategyName)
      if (!info) return
      const resolved = withResolvedCustomStrategyParams(info, strategies, customStrategies)
      const slotId = createEntrySlotId()
      setEntries((current) => [
        ...current,
        {
          slotId,
          strategy: strategyName,
          params: entryDefaultsFromSpecs(resolved.params),
        },
      ])
      setEntrySearchSpaces((current) => ({
        ...current,
        [slotId]: defaultEntrySearchSpaceFromSpecs(resolved.params),
      }))
      setExitSearchSpace((current) => mergeExitSearchSpaceDefaults(current, resolved.params))
      setStrategy((current) => current || strategyName)
    },
    [strategies, customStrategies],
  )

  const removeEntry = useCallback((slotId: string) => {
    setEntries((current) => {
      if (current.length <= 1) return current
      const next = current.filter((entry) => entry.slotId !== slotId)
      setEntryManager((manager) => {
        if (manager.kind !== 'majority' || manager.params.vote_threshold == null) {
          return manager
        }
        const vote = Number(manager.params.vote_threshold)
        return {
          ...manager,
          params: {
            ...manager.params,
            vote_threshold: Math.min(Math.max(vote, 1), Math.max(next.length, 1)),
          },
        }
      })
      return next
    })
    setEntrySearchSpaces((current) => {
      if (!(slotId in current)) return current
      const next = { ...current }
      delete next[slotId]
      return next
    })
  }, [])

  const handleEntrySearchSpaceChange = useCallback(
    (slotId: string, name: string, field: SearchSpaceFieldState) => {
      setEntrySearchSpaces((current) => ({
        ...current,
        [slotId]: { ...current[slotId], [name]: field },
      }))
    },
    [],
  )

  const handleExitSearchSpaceChange = useCallback((name: string, field: SearchSpaceFieldState) => {
    setExitSearchSpace((current) => ({ ...current, [name]: field }))
  }, [])

  const handleManagerSearchSpaceChange = useCallback(
    (name: string, field: SearchSpaceFieldState) => {
      setManagerSearchSpace((current) => ({ ...current, [name]: field }))
    },
    [],
  )

  const dateRangeInvalid = startDate >= endDate
  const costValidation = useMemo(() => validateTransactionCosts(costFields), [costFields])

  const searchSpacesValid = useMemo(() => {
    const entryValid = Object.values(entrySearchSpaces).every((space) => validateSearchSpace(space))
    const exitValid = validateSearchSpace(exitSearchSpace)
    const managerValid = entryManager.kind !== 'majority' || validateSearchSpace(managerSearchSpace)
    return entryValid && exitValid && managerValid
  }, [entrySearchSpaces, exitSearchSpace, entryManager.kind, managerSearchSpace])

  const rangesInvalid =
    (riskMode === 'fixed_quantity'
      ? qtyLow > qtyHigh
      : riskMode === 'fixed_safety_margin'
        ? marginLow > marginHigh || minContractsLow > minContractsHigh
        : targetVolLow > targetVolHigh || inverseMinContractsLow > inverseMinContractsHigh) ||
    !searchSpacesValid

  const isMultiObjective = objective === 'multi_objective_return_drawdown'

  const formInvalid =
    dateRangeInvalid ||
    rangesInvalid ||
    nTrials < 1 ||
    !costValidation.valid ||
    isMaxWorkersInputInvalid(maxWorkersInput) ||
    entries.length === 0

  const fields: OptimizeConfigFields = {
    symbol,
    timeframe,
    startDate,
    endDate,
    capital,
    pointValue,
    dayTrade,
    dayTradeStartTime,
    dayTradeEndTime,
    dayTradeCloseTime,
    engine,
    displayTimeframe,
    tickFlags,
    objective,
    sampler,
    nTrials,
    seed,
    pruner,
    continueOnTrialError,
    maxWorkersInput,
    strategy,
    entries,
    entryManager,
    entrySearchSpaces,
    exitSearchSpace,
    managerSearchSpace,
    riskMode,
    qtyLow,
    qtyHigh,
    marginLow,
    marginHigh,
    minContractsLow,
    minContractsHigh,
    targetVolLow,
    targetVolHigh,
    inverseMinContractsLow,
    inverseMinContractsHigh,
    inverseMaxContractsInput,
    costFields,
  }

  const setters: OptimizeConfigSetters = {
    setSymbol,
    setTimeframe,
    setStartDate,
    setEndDate,
    setCapital,
    setPointValue,
    setDayTrade,
    setDayTradeStartTime,
    setDayTradeEndTime,
    setDayTradeCloseTime,
    setEngine,
    setDisplayTimeframe,
    setTickFlags,
    setObjective,
    setSampler,
    setNTrials,
    setSeed,
    setPruner,
    setContinueOnTrialError,
    setMaxWorkersInput,
    setStrategy,
    setRiskMode,
    setQtyLow,
    setQtyHigh,
    setMarginLow,
    setMarginHigh,
    setMinContractsLow,
    setMinContractsHigh,
    setTargetVolLow,
    setTargetVolHigh,
    setInverseMinContractsLow,
    setInverseMinContractsHigh,
    setInverseMaxContractsInput,
    setCostFields,
    handleEngineChange,
    handleStrategyChange,
    addEntry,
    removeEntry,
    setEntryManager: setEntryManagerState,
    handleEntrySearchSpaceChange,
    handleExitSearchSpaceChange,
    handleManagerSearchSpaceChange,
  }

  const validation: OptimizeConfigValidation = {
    dateRangeInvalid,
    rangesInvalid,
    costValidation,
    formInvalid,
    costErrors: costValidation.errors,
    isMultiObjective,
  }

  const buildOptimizationConfigPayload = () => {
    if (!selectedStrategy || entries.length === 0) {
      throw new Error('No strategy selected')
    }

    const multiEntry = isNamespacedMultiEntryPayload(entries, entryManager)
    const primaryStrategyName = entries[0].strategy

    const config = buildOptimizationConfig(
      fields,
      primaryStrategyName,
      multiEntry
        ? {
            entries,
            entryManager,
            exitParams: {},
          }
        : undefined,
    )

    if (multiEntry) {
      config.search_space.strategy_params = buildMultiEntryStrategyParamsSearchSpacePayload(
        entries,
        entrySearchSpaces,
        exitSearchSpace,
        resolveEntryParamSpecs,
        exitParamSpecs,
        applicableExitRules,
        candidateExitRuleIds,
        exitCatalog?.shared_exit_params ?? [],
      )
      if (entryManager.kind === 'majority' && managerParamSpecs.length > 0) {
        config.search_space.manager_params = buildManagerSearchSpacePayload(
          managerSearchSpace,
          managerParamSpecs,
        )
      }
    } else {
      const singleSlotId = entries[0].slotId
      const singleEntrySpace = entrySearchSpaces[singleSlotId] ?? {}
      config.search_space.strategy_params = buildStrategyParamsSearchSpacePayload(
        { ...singleEntrySpace, ...exitSearchSpace },
        resolveEntryParamSpecs(entries[0].strategy),
        exitParamSpecs,
        applicableExitRules,
        candidateExitRuleIds,
        exitCatalog?.shared_exit_params ?? [],
      )
    }

    return config
  }

  return {
    fields,
    setters,
    strategies,
    filteredStrategies,
    customStrategies,
    customStrategyNames,
    selectedStrategy,
    entries,
    entryManager,
    entrySearchSpaces,
    exitSearchSpace,
    managerSearchSpace,
    instanceCounts: instanceCountByStrategy(entries),
    entryParamSpecs,
    exitParamSpecs,
    resolveEntryParamSpecs,
    applicableExitRules,
    candidateExitRuleIds,
    candidateExitParamSpecs,
    managerParamSpecs,
    toggleExitRule,
    strategiesLoading: strategiesLoading || customStrategiesLoading,
    validation,
    buildOptimizationConfig: buildOptimizationConfigPayload,
  }
}
