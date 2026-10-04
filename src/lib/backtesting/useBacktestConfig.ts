import axios from 'axios'
import { endOfDay, startOfDay } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  useCustomStrategies,
  useDeleteCustomStrategy,
  useSaveCustomStrategy,
} from '@/api/queries/customStrategies'
import { useExitRuleCatalog, useStrategies } from '@/api/queries/strategies'
import {
  createEntrySlotId,
  defaultEntryManager,
  entryDefaultsFromSpecs,
  splitParamsByPartition,
  toEntryManagerPayload,
  toEntryPayload,
  type EntryInstanceState,
  type EntryManagerState,
} from '@/lib/backtesting/entryInstances'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import {
  DEFAULT_ML_FILTER_THRESHOLD,
  INACTIVE_ML_FILTER_VALIDATION,
  defaultMlFilterFormState,
  diffMlFilterBaseline,
  validateMlFilterConfig,
  type MlFilterFormState,
  type MlFilterValidation,
} from '@/lib/backtesting/mlFilterConfig'
import {
  buildPositionSizingPayload,
  defaultPositionSizingFields,
  hydratePositionSizingFields,
  validatePositionSizing,
  type PositionSizingFields,
  type PositionSizingMode,
} from '@/lib/backtesting/positionSizing'
import {
  buildCostsPayload,
  defaultTransactionCostFields,
  hydrateTransactionCostFields,
  validateTransactionCosts,
  type TransactionCostFields,
} from '@/lib/backtesting/transactionCosts'
import {
  hydrateStrategyParamsFromPending,
  type StrategyParamValue,
} from '@/lib/strategies/strategyParams'
import { ML_FILTER_STRATEGY } from '@/lib/strategies/strategyCapabilities'
import { strategyEngine } from '@/lib/strategies/strategyPresentation'
import { getMlFilterErrorMessage } from '@/api/queries/mlFilters'
import { prepareMlFilterBacktest } from '@/lib/mlFilters/prepareMlFilterBacktest'
import { useMlFilterModelContext } from '@/lib/mlFilters/useMlFilterModelContext'
import { toast } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'
import type { CustomStrategy, ExitRuleCatalogResponse, StrategyParamSpec } from '@/types/strategies'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

export type BacktestEngine = 'candle' | 'tick'

export const DISPLAY_TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'H1'] as const

export { strategyEngine } from '@/lib/strategies/strategyPresentation'

export type { EntryInstanceState, EntryManagerState } from '@/lib/backtesting/entryInstances'

export type BacktestConfigFields = {
  symbol: string
  timeframe: string
  startDate: Date
  endDate: Date
  capital: number
  pointValue: number
  sizingMode: PositionSizingMode
  positionSizingFields: PositionSizingFields
  costFields: TransactionCostFields
  strategy: string
  /** Exit params only — shared across all entry instances. */
  strategyParams: Record<string, StrategyParamValue>
  entries: EntryInstanceState[]
  entryManager: EntryManagerState
  dayTrade: boolean
  dayTradeStartTime: string
  dayTradeEndTime: string
  dayTradeCloseTime: string
  engine: BacktestEngine
  displayTimeframe: string
  tickFlags: 'all' | 'trade'
  /** Only meaningful for MACrossoverMLFilter; omitted from every other request. */
  mlFilter?: MlFilterFormState
}

export type BacktestConfigSetters = {
  setSymbol: (value: string) => void
  setTimeframe: (value: string) => void
  setStartDate: (value: Date) => void
  setEndDate: (value: Date) => void
  setCapital: (value: number) => void
  setPointValue: (value: number) => void
  setSizingMode: (value: PositionSizingMode) => void
  setPositionSizingFields: React.Dispatch<React.SetStateAction<PositionSizingFields>>
  setCostFields: React.Dispatch<React.SetStateAction<TransactionCostFields>>
  setStrategy: (value: string) => void
  setStrategyParams: React.Dispatch<React.SetStateAction<Record<string, StrategyParamValue>>>
  setDayTrade: (value: boolean) => void
  setDayTradeStartTime: (value: string) => void
  setDayTradeEndTime: (value: string) => void
  setDayTradeCloseTime: (value: string) => void
  setEngine: (value: BacktestEngine) => void
  setDisplayTimeframe: (value: string) => void
  setTickFlags: (value: 'all' | 'trade') => void
  handleEngineChange: (nextEngine: BacktestEngine) => void
  handleStrategyChange: (nextStrategy: string) => void
  handleParamChange: (name: string, value: StrategyParamValue) => void
  addEntry: (strategyName: string) => void
  removeEntry: (slotId: string) => void
  handleEntryParamChange: (slotId: string, name: string, value: StrategyParamValue) => void
  setEntryManager: (manager: EntryManagerState) => void
  updateSizingField: <K extends keyof PositionSizingFields>(
    key: K,
    value: PositionSizingFields[K],
  ) => void
}

export type BacktestConfigValidation = {
  dateRangeInvalid: boolean
  positionSizingValidation: ReturnType<typeof validatePositionSizing>
  costValidation: ReturnType<typeof validateTransactionCosts>
  formInvalid: boolean
  sizingErrors: Partial<Record<string, string>>
  costErrors: Partial<Record<string, string>>
  mlFilter: MlFilterValidation
}

export type BacktestConfigAuthoring = {
  customName: string
  description: string
  loadedCustomName: string | null
  authoringError: string | null
  setCustomName: (value: string) => void
  setDescription: (value: string) => void
  newDraft: () => void
  loadCustom: (custom: CustomStrategy) => void
  saveCustom: () => void
  saveCustomPayload: (payload: CustomStrategy) => void
  deleteCustom: (name: string) => void
  handleParamsMerge: (updates: Record<string, StrategyParamValue>) => void
  isSaving: boolean
}

export function buildBacktestRequest(fields: BacktestConfigFields): BacktestRequest {
  const {
    symbol,
    engine,
    timeframe,
    startDate,
    endDate,
    capital,
    pointValue,
    sizingMode,
    positionSizingFields,
    costFields,
    strategy,
    strategyParams: exitParams,
    entries,
    entryManager,
    dayTrade,
    dayTradeStartTime,
    dayTradeEndTime,
    dayTradeCloseTime,
    displayTimeframe,
    tickFlags,
    mlFilter,
  } = fields

  const common = {
    symbol,
    ...(engine === 'candle' ? { timeframe } : {}),
    start: startOfDay(startDate).toISOString(),
    end: endOfDay(endDate).toISOString(),
    initial_capital: capital,
    point_value: pointValue,
    position_sizing: buildPositionSizingPayload(sizingMode, positionSizingFields),
    ...(() => {
      const costs = buildCostsPayload(costFields)
      return costs ? { costs } : {}
    })(),
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
  }

  if (strategy === 'CompositeStrategy') {
    return {
      ...common,
      strategy,
      strategy_params: exitParams,
    }
  }

  const entryPayload = toEntryPayload(entries)
  // The tick engine builds its strategy from strategy/strategy_params and has no
  // multi-entry path, so it takes neither entries nor an entry manager. Sending
  // them anyway is what the API refuses.
  const payload: BacktestRequest = {
    ...common,
    ...(engine === 'tick'
      ? {}
      : {
          entries: entryPayload,
          entry_manager: toEntryManagerPayload(entryManager),
        }),
    exit_params: exitParams,
  }

  const singleOr = entries.length === 1 && entryManager.kind === 'or'
  if (singleOr) {
    payload.strategy = entries[0].strategy
    payload.strategy_params = { ...entries[0].params, ...exitParams }
  } else if (entries.length > 0) {
    payload.strategy = entries[0].strategy
    payload.strategy_params = exitParams
  } else {
    payload.strategy = strategy
    payload.strategy_params = exitParams
  }

  if (payload.strategy === ML_FILTER_STRATEGY && mlFilter?.modelVersionId) {
    payload.ml_filter = {
      model_version_id: mlFilter.modelVersionId,
      threshold: mlFilter.threshold,
    }
  }

  return payload
}

export function useBacktestConfig() {
  const [symbol, setSymbol] = useState('PETR4')
  const [timeframe, setTimeframe] = useState('D1')
  const [startDate, setStartDate] = useState(defaultBacktestStart)
  const [endDate, setEndDate] = useState(defaultBacktestEnd)
  const [capital, setCapital] = useState(100000)
  const [pointValue, setPointValue] = useState(1.0)
  const [sizingMode, setSizingMode] = useState<PositionSizingMode>('fixed_quantity')
  const [positionSizingFields, setPositionSizingFields] = useState(defaultPositionSizingFields)
  const [costFields, setCostFields] = useState(defaultTransactionCostFields)
  const [strategy, setStrategy] = useState('MACrossover')
  const [strategyParams, setStrategyParams] = useState<Record<string, StrategyParamValue>>({})
  const [entries, setEntries] = useState<EntryInstanceState[]>([])
  const [entryManager, setEntryManager] = useState<EntryManagerState>(defaultEntryManager)
  const [dayTrade, setDayTrade] = useState(false)
  const [dayTradeStartTime, setDayTradeStartTime] = useState('09:00')
  const [dayTradeEndTime, setDayTradeEndTime] = useState('16:00')
  const [dayTradeCloseTime, setDayTradeCloseTime] = useState('17:00')
  const [engine, setEngine] = useState<BacktestEngine>('candle')
  const [displayTimeframe, setDisplayTimeframe] = useState('M1')
  const [tickFlags, setTickFlags] = useState<'all' | 'trade'>('all')
  const [customName, setCustomName] = useState('')
  const [description, setDescription] = useState('')
  const [loadedCustomName, setLoadedCustomName] = useState<string | null>(null)
  const [authoringError, setAuthoringError] = useState<string | null>(null)
  const [mlFilterForm, setMlFilterForm] = useState<MlFilterFormState>(defaultMlFilterFormState)
  const [mlFilterBaselineError, setMlFilterBaselineError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: strategiesData, isLoading: strategiesLoading } = useStrategies()
  const { data: exitCatalog, isLoading: exitCatalogLoading } = useExitRuleCatalog()
  const { data: customStrategies, isLoading: customLoading } = useCustomStrategies()
  const saveCustomStrategy = useSaveCustomStrategy()
  const deleteCustomStrategy = useDeleteCustomStrategy()
  const strategies = useMemo(() => strategiesData?.strategies ?? [], [strategiesData?.strategies])
  const filteredStrategies = useMemo(
    () => strategies.filter((entry) => strategyEngine(entry) === engine),
    [strategies, engine],
  )
  const selectedStrategy = filteredStrategies.find((entry) => entry.name === strategy)
  const primaryEntryStrategy = useMemo(() => {
    const primaryName = entries[0]?.strategy ?? strategy
    return strategies.find((entry) => entry.name === primaryName)
  }, [entries, strategy, strategies])
  const customNames = useMemo(
    () => new Set(customStrategies?.map((entry) => entry.name) ?? []),
    [customStrategies],
  )
  const builtInStrategies = useMemo(
    () =>
      strategies.filter(
        (entry) => !customNames.has(entry.name) && entry.name !== 'CompositeStrategy',
      ),
    [strategies, customNames],
  )
  const { entryParamSpecs, exitParamSpecs } = useMemo(() => {
    const exitSpecsByName = new Map<string, StrategyParamSpec>()
    for (const entry of entries) {
      const info = strategies.find((item) => item.name === entry.strategy)
      if (!info) continue
      const partitioned = partitionStrategyParamSpecs(info.params)
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
  }, [entries, primaryEntryStrategy?.params, strategies])
  const paramsInitialized = useRef(false)

  const installSingleEntry = useCallback(
    (
      strategyName: string,
      mergedParams?: Record<string, unknown>,
      strategyInfo = strategies.find((entry) => entry.name === strategyName),
    ) => {
      if (strategyName === 'CompositeStrategy') {
        setStrategy(strategyName)
        setEntries([])
        if (mergedParams) {
          setStrategyParams(mergedParams as Record<string, StrategyParamValue>)
        }
        return
      }

      if (strategyInfo) {
        const { entryParams, exitParams } = splitParamsByPartition(
          strategyInfo.params,
          mergedParams,
        )
        setEntries([
          {
            slotId: createEntrySlotId(),
            strategy: strategyName,
            params: entryParams,
          },
        ])
        setStrategyParams(exitParams)
      } else {
        setEntries([
          {
            slotId: createEntrySlotId(),
            strategy: strategyName,
            params: (mergedParams ?? {}) as Record<string, StrategyParamValue>,
          },
        ])
        setStrategyParams({})
      }
      setStrategy(strategyName)
    },
    [strategies],
  )

  const pendingBacktestConfig = useAppStore((s) => s.pendingBacktestConfig)
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)

  useEffect(() => {
    if (strategies.length === 0 || paramsInitialized.current || pendingBacktestConfig) return
    const pool = strategies.filter((entry) => strategyEngine(entry) === engine)
    const info = pool.find((entry) => entry.name === strategy) ?? pool[0]
    if (!info) return
    if (!pool.some((entry) => entry.name === strategy)) {
      installSingleEntry(info.name, undefined, info)
    } else {
      installSingleEntry(strategy, undefined, info)
    }
    paramsInitialized.current = true
  }, [strategies, strategy, engine, installSingleEntry, pendingBacktestConfig])

  useEffect(() => {
    if (!pendingBacktestConfig || strategies.length === 0) return
    const cfg = pendingBacktestConfig

    if (cfg.symbol) setSymbol(cfg.symbol)
    if (cfg.timeframe) setTimeframe(cfg.timeframe)
    if (cfg.start) setStartDate(startOfDay(new Date(cfg.start)))
    if (cfg.end) setEndDate(endOfDay(new Date(cfg.end)))
    if (cfg.initial_capital != null) setCapital(cfg.initial_capital)
    if (cfg.point_value != null) setPointValue(cfg.point_value)
    if (cfg.strategy) setStrategy(cfg.strategy)

    if (cfg.strategy === 'CompositeStrategy') {
      const strategyInfo = strategies.find((entry) => entry.name === cfg.strategy)
      if (strategyInfo) {
        setStrategyParams(
          hydrateStrategyParamsFromPending(strategyInfo.params, cfg.strategy_params),
        )
      } else if (cfg.strategy_params) {
        setStrategyParams(cfg.strategy_params as Record<string, StrategyParamValue>)
      }
      setEntries([])
      paramsInitialized.current = true
    } else if (cfg.entries?.length) {
      setEntries(
        cfg.entries.map((entry, index) => ({
          slotId: `slot-${index}`,
          strategy: entry.strategy,
          params: entry.params as Record<string, StrategyParamValue>,
        })),
      )
      if (cfg.entry_manager) {
        setEntryManager({
          kind: cfg.entry_manager.kind as EntryManagerState['kind'],
          params: (cfg.entry_manager.params ?? {}) as Record<string, StrategyParamValue>,
        })
      } else {
        setEntryManager(defaultEntryManager())
      }
      if (cfg.exit_params) {
        setStrategyParams(cfg.exit_params as Record<string, StrategyParamValue>)
      } else if (cfg.strategy_params) {
        const strategyInfo =
          strategies.find((entry) => entry.name === (cfg.entries?.[0]?.strategy ?? cfg.strategy)) ??
          selectedStrategy
        if (strategyInfo) {
          const { exitParams } = splitParamsByPartition(strategyInfo.params, cfg.strategy_params)
          setStrategyParams(exitParams)
        }
      }
      paramsInitialized.current = true
    } else if (cfg.strategy) {
      const strategyInfo =
        strategies.find((entry) => entry.name === cfg.strategy) ?? selectedStrategy
      installSingleEntry(
        cfg.strategy,
        cfg.strategy_params as Record<string, unknown> | undefined,
        strategyInfo,
      )
      paramsInitialized.current = true
    } else if (cfg.strategy_params) {
      setStrategyParams(cfg.strategy_params as Record<string, StrategyParamValue>)
      paramsInitialized.current = true
    }

    if (cfg.ml_filter) {
      setMlFilterForm({
        modelVersionId: cfg.ml_filter.model_version_id,
        threshold: cfg.ml_filter.threshold ?? DEFAULT_ML_FILTER_THRESHOLD,
      })
    } else if (cfg.strategy !== ML_FILTER_STRATEGY) {
      setMlFilterForm(defaultMlFilterFormState())
    }
    if (cfg.strategy === ML_FILTER_STRATEGY && !cfg.entries?.length) {
      setEntryManager(defaultEntryManager())
    }

    const hydratedSizing = hydratePositionSizingFields(cfg.position_sizing)
    setSizingMode(hydratedSizing.mode)
    setPositionSizingFields(hydratedSizing.fields)
    setCostFields(hydrateTransactionCostFields(cfg.costs))

    if (cfg.day_trade !== undefined) setDayTrade(cfg.day_trade)
    if (cfg.day_trade_start_time) setDayTradeStartTime(cfg.day_trade_start_time)
    if (cfg.day_trade_end_time) setDayTradeEndTime(cfg.day_trade_end_time)
    if (cfg.day_trade_close_time) setDayTradeCloseTime(cfg.day_trade_close_time)
    if (cfg.engine === 'tick' || cfg.engine === 'candle') setEngine(cfg.engine)
    if (cfg.display_timeframe) setDisplayTimeframe(cfg.display_timeframe)
    if (cfg.tick_flags === 'all' || cfg.tick_flags === 'trade') setTickFlags(cfg.tick_flags)

    setPendingBacktestConfig(null)
  }, [
    pendingBacktestConfig,
    setPendingBacktestConfig,
    strategies,
    strategy,
    selectedStrategy,
    installSingleEntry,
  ])

  const handleEngineChange = useCallback(
    (nextEngine: BacktestEngine) => {
      setEngine(nextEngine)
      const pool = strategies.filter((entry) => strategyEngine(entry) === nextEngine)
      if (pool.length === 0) return
      const currentValid = pool.some((entry) => entry.name === strategy)
      if (!currentValid) {
        const next = pool[0]
        installSingleEntry(next.name, undefined, next)
      }
    },
    [strategies, strategy, installSingleEntry],
  )

  const handleStrategyChange = useCallback(
    (nextStrategy: string) => {
      const info = strategies.find((entry) => entry.name === nextStrategy)
      installSingleEntry(nextStrategy, undefined, info)
    },
    [strategies, installSingleEntry],
  )

  const addEntry = useCallback(
    (strategyName: string) => {
      const info = strategies.find((entry) => entry.name === strategyName)
      if (!info) return
      // The ML variant supports exactly one entry; extra-entry controls are hidden for it.
      if (strategy === ML_FILTER_STRATEGY || strategyName === ML_FILTER_STRATEGY) return
      setEntries((current) => [
        ...current,
        {
          slotId: createEntrySlotId(),
          strategy: strategyName,
          params: entryDefaultsFromSpecs(info.params),
        },
      ])
      setStrategy((current) => current || strategyName)
    },
    [strategies, strategy],
  )

  const removeEntry = useCallback((slotId: string) => {
    setEntries((current) => {
      if (current.length <= 1) return current
      return current.filter((entry) => entry.slotId !== slotId)
    })
  }, [])

  const handleEntryParamChange = useCallback(
    (slotId: string, name: string, value: StrategyParamValue) => {
      setEntries((current) =>
        current.map((entry) =>
          entry.slotId === slotId
            ? { ...entry, params: { ...entry.params, [name]: value } }
            : entry,
        ),
      )
    },
    [],
  )

  const handleParamChange = useCallback((name: string, value: StrategyParamValue) => {
    setStrategyParams((current) => ({ ...current, [name]: value }))
  }, [])

  const handleParamsMerge = useCallback((updates: Record<string, StrategyParamValue>) => {
    setStrategyParams((current) => ({ ...current, ...updates }))
  }, [])

  const clearAuthoringDraft = useCallback(() => {
    setLoadedCustomName(null)
    setCustomName('')
    setDescription('')
    setAuthoringError(null)
  }, [])

  const newDraft = useCallback(() => {
    clearAuthoringDraft()
  }, [clearAuthoringDraft])

  const loadCustom = useCallback(
    (custom: CustomStrategy) => {
      setLoadedCustomName(custom.name)
      setCustomName(custom.name)
      setDescription(custom.description ?? '')
      const baseInfo = strategies.find((entry) => entry.name === custom.base_strategy)
      installSingleEntry(custom.base_strategy, custom.parameters, baseInfo)
      setAuthoringError(null)
      paramsInitialized.current = true
    },
    [strategies, installSingleEntry],
  )

  const saveCustomPayload = useCallback(
    (payload: CustomStrategy) => {
      setAuthoringError(null)
      saveCustomStrategy.mutate(payload, {
        onSuccess: () => {
          setLoadedCustomName(payload.name)
          setCustomName(payload.name)
          setDescription(payload.description ?? '')
          toast.success(`Strategy "${payload.name}" saved`)
        },
        onError: (err: unknown) => {
          const message = axios.isAxiosError(err)
            ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
            : err instanceof Error
              ? err.message
              : 'Failed to save strategy.'
          setAuthoringError(message)
        },
      })
    },
    [saveCustomStrategy],
  )

  const saveCustom = useCallback(() => {
    setAuthoringError(null)
    const trimmedName = customName.trim()
    if (!trimmedName) {
      setAuthoringError('Strategy name is required.')
      return
    }

    const isBuiltIn = builtInStrategies.some(
      (entry) => entry.name.toLowerCase() === trimmedName.toLowerCase(),
    )
    if (isBuiltIn) {
      setAuthoringError(
        `"${trimmedName}" conflicts with a built-in strategy name. Please choose a different name.`,
      )
      return
    }

    if (!loadedCustomName && customNames.has(trimmedName)) {
      setAuthoringError(`A custom strategy named "${trimmedName}" already exists.`)
      return
    }

    saveCustomPayload({
      name: trimmedName,
      base_strategy: entries[0]?.strategy ?? strategy,
      description: description.trim(),
      parameters: {
        ...(entries[0]?.params ?? {}),
        ...strategyParams,
      },
    })
  }, [
    builtInStrategies,
    customName,
    customNames,
    description,
    entries,
    loadedCustomName,
    saveCustomPayload,
    strategy,
    strategyParams,
  ])

  const deleteCustom = useCallback(
    (name: string) => {
      if (!window.confirm(`Are you sure you want to delete the custom strategy "${name}"?`)) {
        return
      }

      deleteCustomStrategy.mutate(name, {
        onSuccess: () => {
          if (loadedCustomName === name) {
            clearAuthoringDraft()
          }
        },
      })
    },
    [clearAuthoringDraft, deleteCustomStrategy, loadedCustomName],
  )

  const updateSizingField = useCallback(
    <K extends keyof PositionSizingFields>(key: K, value: PositionSizingFields[K]) => {
      setPositionSizingFields((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  const dateRangeInvalid = startDate >= endDate

  const positionSizingValidation = useMemo(
    () => validatePositionSizing(sizingMode, positionSizingFields),
    [sizingMode, positionSizingFields],
  )

  const costValidation = useMemo(() => validateTransactionCosts(costFields), [costFields])

  const isMlFilterStrategy = strategy === ML_FILTER_STRATEGY
  const mlFilterModel = useMlFilterModelContext(
    isMlFilterStrategy ? mlFilterForm.modelVersionId : null,
    isMlFilterStrategy,
  )

  const baseFields = {
    symbol,
    timeframe,
    startDate,
    endDate,
    capital,
    pointValue,
    sizingMode,
    positionSizingFields,
    costFields,
    strategy,
    strategyParams,
    entries,
    entryManager,
    dayTrade,
    dayTradeStartTime,
    dayTradeEndTime,
    dayTradeCloseTime,
    engine,
    displayTimeframe,
    tickFlags,
  }

  const mlFilterValidation = useMemo<MlFilterValidation>(() => {
    if (!isMlFilterStrategy) return INACTIVE_ML_FILTER_VALIDATION
    const { baseline } = mlFilterModel.context
    const diff = baseline
      ? diffMlFilterBaseline(
          baseline,
          buildBacktestRequest({ ...baseFields, mlFilter: mlFilterForm }),
          strategies,
        )
      : []
    const summary = mlFilterModel.context.summary
    if (
      !baseline &&
      summary &&
      mlFilterModel.context.status === 'ready' &&
      !mlFilterModel.context.baselineLoading
    ) {
      if (summary.symbol && summary.symbol !== symbol) diff.push('symbol')
      if (summary.timeframe && summary.timeframe !== timeframe) diff.push('timeframe')
    }
    return validateMlFilterConfig({
      strategy,
      entryCount: entries.length,
      entryManagerKind: entryManager.kind,
      engine,
      startDate,
      form: mlFilterForm,
      context: mlFilterModel.context,
      baselineDiff: diff,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isMlFilterStrategy,
    mlFilterModel.context,
    mlFilterForm,
    strategies,
    symbol,
    timeframe,
    startDate,
    entries,
    entryManager,
    engine,
    strategy,
    strategyParams,
    sizingMode,
    positionSizingFields,
    costFields,
    dayTrade,
    dayTradeStartTime,
    dayTradeEndTime,
    dayTradeCloseTime,
    pointValue,
  ])

  const formInvalid =
    dateRangeInvalid ||
    !positionSizingValidation.valid ||
    !costValidation.valid ||
    mlFilterValidation.blocking

  const selectMlFilterModel = useCallback(
    async (modelVersionId: string) => {
      setMlFilterBaselineError(null)
      setMlFilterForm((current) => ({ ...current, modelVersionId }))
      try {
        const request = await prepareMlFilterBacktest(
          queryClient,
          modelVersionId,
          mlFilterForm.threshold,
        )
        // Inherit the model's baseline through the shared pending-config path so the
        // form shows explicit, editable values.
        setPendingBacktestConfig(request)
      } catch (error) {
        setMlFilterBaselineError(
          getMlFilterErrorMessage(error, 'Could not load the model baseline.'),
        )
      }
    },
    [queryClient, mlFilterForm.threshold, setPendingBacktestConfig],
  )

  const fields: BacktestConfigFields = {
    symbol,
    timeframe,
    startDate,
    endDate,
    capital,
    pointValue,
    sizingMode,
    positionSizingFields,
    costFields,
    strategy,
    strategyParams,
    entries,
    entryManager,
    dayTrade,
    dayTradeStartTime,
    dayTradeEndTime,
    dayTradeCloseTime,
    engine,
    displayTimeframe,
    tickFlags,
    mlFilter: mlFilterForm,
  }

  const setters: BacktestConfigSetters = {
    setSymbol,
    setTimeframe,
    setStartDate,
    setEndDate,
    setCapital,
    setPointValue,
    setSizingMode,
    setPositionSizingFields,
    setCostFields,
    setStrategy,
    setStrategyParams,
    setDayTrade,
    setDayTradeStartTime,
    setDayTradeEndTime,
    setDayTradeCloseTime,
    setEngine,
    setDisplayTimeframe,
    setTickFlags,
    handleEngineChange,
    handleStrategyChange,
    handleParamChange,
    addEntry,
    removeEntry,
    handleEntryParamChange,
    setEntryManager,
    updateSizingField,
  }

  const validation: BacktestConfigValidation = {
    dateRangeInvalid,
    positionSizingValidation,
    costValidation,
    formInvalid,
    sizingErrors: positionSizingValidation.errors,
    costErrors: costValidation.errors,
    mlFilter: mlFilterValidation,
  }

  const buildRequest = useCallback(() => buildBacktestRequest(fields), [fields])

  const authoring: BacktestConfigAuthoring = {
    customName,
    description,
    loadedCustomName,
    authoringError,
    setCustomName,
    setDescription,
    newDraft,
    loadCustom,
    saveCustom,
    saveCustomPayload,
    deleteCustom,
    handleParamsMerge,
    isSaving: saveCustomStrategy.isPending,
  }

  return {
    fields,
    setters,
    strategies,
    filteredStrategies,
    builtInStrategies,
    selectedStrategy: primaryEntryStrategy ?? selectedStrategy,
    strategiesLoading,
    entryParamSpecs,
    exitParamSpecs,
    entries,
    entryManager,
    exitCatalog: exitCatalog as ExitRuleCatalogResponse | undefined,
    exitCatalogLoading,
    customStrategies: customStrategies ?? [],
    customLoading,
    validation,
    buildRequest,
    authoring,
    mlFilter: {
      form: mlFilterForm,
      validation: mlFilterValidation,
      context: mlFilterModel.context,
      models: mlFilterModel.models,
      modelsLoading: mlFilterModel.modelsLoading,
      baselineError: mlFilterBaselineError,
      selectModel: selectMlFilterModel,
      setThreshold: (threshold: number) =>
        setMlFilterForm((current) => ({ ...current, threshold })),
    },
  }
}
