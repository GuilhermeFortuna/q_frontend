import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useCustomStrategies } from '@/api/queries/customStrategies'
import { useExitRuleCatalog, useStrategies } from '@/api/queries/strategies'
import type { RiskMode } from '@/components/optimize/optimizeFormShared'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import {
  buildCostsPayload,
  defaultTransactionCostFields,
  validateTransactionCosts,
  type TransactionCostFields,
} from '@/lib/backtesting/transactionCosts'
import {
  buildStrategyParamsSearchSpacePayload,
  buildCandidateExitParamSpecs,
  filterApplicableExitRules,
  initialCandidateExitRuleIds,
} from '@/lib/optimize/exitSearchSpace'
import { hydrateOptimizeFormFromConfig } from '@/lib/optimize/hydrateConfigForm'
import { isMaxWorkersInputInvalid, withMaxWorkers } from '@/lib/optimize/studyConfig'
import { withResolvedCustomStrategyParams } from '@/lib/strategies/resolveCustomStrategyParams'
import { strategyEngine } from '@/lib/strategies/strategyPresentation'
import {
  defaultSearchSpaceFromSpecs,
  searchSpaceToPayload,
  validateSearchSpace,
  type SearchSpaceFieldState,
} from '@/lib/strategies/strategyParams'
import { useAppStore } from '@/store/useAppStore'
import type { ObjectiveMode, OptimizationConfig, Sampler, SearchParam } from '@/types/optimization'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

export type OptimizeEngine = 'candle' | 'tick'

export const DISPLAY_TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'H1'] as const

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
  strategySearchSpace: Record<string, SearchSpaceFieldState>
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
  setStrategySearchSpace: React.Dispatch<
    React.SetStateAction<Record<string, SearchSpaceFieldState>>
  >
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
  handleSearchSpaceChange: (name: string, field: SearchSpaceFieldState) => void
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
): OptimizationConfig {
  const {
    symbol,
    engine,
    timeframe,
    startDate,
    endDate,
    capital,
    pointValue,
    strategySearchSpace,
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
      strategy_params: searchSpaceToPayload(strategySearchSpace, []),
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
  const [strategySearchSpace, setStrategySearchSpace] = useState<
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
  const { data: customStrategies = [], isLoading: customStrategiesLoading } = useCustomStrategies()
  const strategies = useMemo(() => strategiesData?.strategies ?? [], [strategiesData?.strategies])
  const customStrategyNames = useMemo(
    () => new Set(customStrategies.map((entry) => entry.name)),
    [customStrategies],
  )
  const filteredStrategies = useMemo(
    () => strategies.filter((entry) => strategyEngine(entry) === engine),
    [strategies, engine],
  )
  const selectedStrategy = useMemo(() => {
    const info = filteredStrategies.find((entry) => entry.name === strategy)
    if (!info) return undefined
    return withResolvedCustomStrategyParams(info, strategies, customStrategies)
  }, [filteredStrategies, strategy, strategies, customStrategies])
  const { entryParamSpecs, exitParamSpecs } = useMemo(
    () => partitionStrategyParamSpecs(selectedStrategy?.params ?? []),
    [selectedStrategy?.params],
  )
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
  const searchSpaceInitialized = useRef(false)

  const pendingOptimizationConfig = useAppStore((s) => s.pendingOptimizationConfig)
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)

  useEffect(() => {
    if (strategies.length === 0 || searchSpaceInitialized.current) return
    const pool = strategies.filter((entry) => strategyEngine(entry) === engine)
    const info = pool.find((entry) => entry.name === strategy) ?? pool[0]
    if (!info) return
    const resolved = withResolvedCustomStrategyParams(info, strategies, customStrategies)
    if (!pool.some((entry) => entry.name === strategy)) {
      setStrategy(resolved.name)
    }
    setStrategySearchSpace(defaultSearchSpaceFromSpecs(resolved.params))
    searchSpaceInitialized.current = true
  }, [strategies, strategy, engine, customStrategies])

  useEffect(() => {
    setCandidateExitRuleIds(initialCandidateExitRuleIds(applicableExitRules, exitParamSpecs))
  }, [strategy, applicableExitRules, exitParamSpecs])

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
    setStrategySearchSpace(hydrated.strategySearchSpace)
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
    const currentValid = pool.some((entry) => entry.name === strategy)
    if (!currentValid) {
      const next = withResolvedCustomStrategyParams(pool[0], strategies, customStrategies)
      setStrategy(next.name)
      setStrategySearchSpace(defaultSearchSpaceFromSpecs(next.params))
    }
  }

  const handleStrategyChange = (nextStrategy: string) => {
    setStrategy(nextStrategy)
    const info = strategies.find((entry) => entry.name === nextStrategy)
    if (info) {
      const resolved = withResolvedCustomStrategyParams(info, strategies, customStrategies)
      setStrategySearchSpace(defaultSearchSpaceFromSpecs(resolved.params))
    }
  }

  const handleSearchSpaceChange = (name: string, field: SearchSpaceFieldState) => {
    setStrategySearchSpace((current) => ({ ...current, [name]: field }))
  }

  const dateRangeInvalid = startDate >= endDate
  const costValidation = useMemo(() => validateTransactionCosts(costFields), [costFields])

  const rangesInvalid =
    (riskMode === 'fixed_quantity'
      ? qtyLow > qtyHigh
      : riskMode === 'fixed_safety_margin'
        ? marginLow > marginHigh || minContractsLow > minContractsHigh
        : targetVolLow > targetVolHigh || inverseMinContractsLow > inverseMinContractsHigh) ||
    !validateSearchSpace(strategySearchSpace)

  const isMultiObjective = objective === 'multi_objective_return_drawdown'

  const formInvalid =
    dateRangeInvalid ||
    rangesInvalid ||
    nTrials < 1 ||
    !costValidation.valid ||
    isMaxWorkersInputInvalid(maxWorkersInput)

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
    strategySearchSpace,
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
    setStrategySearchSpace,
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
    handleSearchSpaceChange,
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
    if (!selectedStrategy) {
      throw new Error('No strategy selected')
    }
    const config = buildOptimizationConfig(fields, selectedStrategy.name)
    config.search_space.strategy_params = buildStrategyParamsSearchSpacePayload(
      strategySearchSpace,
      entryParamSpecs,
      exitParamSpecs,
      applicableExitRules,
      candidateExitRuleIds,
      exitCatalog?.shared_exit_params ?? [],
    )
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
    entryParamSpecs,
    exitParamSpecs,
    applicableExitRules,
    candidateExitRuleIds,
    candidateExitParamSpecs,
    toggleExitRule,
    strategiesLoading: strategiesLoading || customStrategiesLoading,
    validation,
    buildOptimizationConfig: buildOptimizationConfigPayload,
  }
}
