import axios from 'axios'
import { endOfDay, startOfDay } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  useCustomStrategies,
  useDeleteCustomStrategy,
  useSaveCustomStrategy,
} from '@/api/queries/customStrategies'
import { useExitRuleCatalog, useStrategies } from '@/api/queries/strategies'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
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
  defaultParamsFromSpecs,
  hydrateStrategyParamsFromPending,
  mergeParamValues,
  type StrategyParamValue,
} from '@/lib/strategies/strategyParams'
import { strategyEngine } from '@/lib/strategies/strategyPresentation'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'
import type { CustomStrategy, ExitRuleCatalogResponse } from '@/types/strategies'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'

export type BacktestEngine = 'candle' | 'tick'

export const DISPLAY_TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'H1'] as const

export { strategyEngine } from '@/lib/strategies/strategyPresentation'

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
  strategyParams: Record<string, StrategyParamValue>
  dayTrade: boolean
  dayTradeStartTime: string
  dayTradeEndTime: string
  dayTradeCloseTime: string
  engine: BacktestEngine
  displayTimeframe: string
  tickFlags: 'all' | 'trade'
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
    strategyParams,
    dayTrade,
    dayTradeStartTime,
    dayTradeEndTime,
    dayTradeCloseTime,
    displayTimeframe,
    tickFlags,
  } = fields

  return {
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
    strategy,
    strategy_params: strategyParams,
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
  const { entryParamSpecs, exitParamSpecs } = useMemo(
    () => partitionStrategyParamSpecs(selectedStrategy?.params ?? []),
    [selectedStrategy?.params],
  )
  const paramsInitialized = useRef(false)

  const pendingBacktestConfig = useAppStore((s) => s.pendingBacktestConfig)
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)

  useEffect(() => {
    if (strategies.length === 0 || paramsInitialized.current) return
    const pool = strategies.filter((entry) => strategyEngine(entry) === engine)
    const info = pool.find((entry) => entry.name === strategy) ?? pool[0]
    if (!info) return
    if (!pool.some((entry) => entry.name === strategy)) {
      setStrategy(info.name)
    }
    setStrategyParams(defaultParamsFromSpecs(info.params))
    paramsInitialized.current = true
  }, [strategies, strategy, engine])

  useEffect(() => {
    if (!pendingBacktestConfig) return
    const cfg = pendingBacktestConfig

    if (cfg.symbol) setSymbol(cfg.symbol)
    if (cfg.timeframe) setTimeframe(cfg.timeframe)
    if (cfg.start) setStartDate(startOfDay(new Date(cfg.start)))
    if (cfg.end) setEndDate(endOfDay(new Date(cfg.end)))
    if (cfg.initial_capital != null) setCapital(cfg.initial_capital)
    if (cfg.point_value != null) setPointValue(cfg.point_value)
    if (cfg.strategy) setStrategy(cfg.strategy)

    const strategyInfo =
      strategies.find((entry) => entry.name === (cfg.strategy ?? strategy)) ?? selectedStrategy
    if (strategyInfo) {
      setStrategyParams(hydrateStrategyParamsFromPending(strategyInfo.params, cfg.strategy_params))
      paramsInitialized.current = true
    } else if (cfg.strategy_params) {
      setStrategyParams(cfg.strategy_params as Record<string, StrategyParamValue>)
      paramsInitialized.current = true
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
  }, [pendingBacktestConfig, setPendingBacktestConfig, strategies, strategy, selectedStrategy])

  const handleEngineChange = useCallback(
    (nextEngine: BacktestEngine) => {
      setEngine(nextEngine)
      const pool = strategies.filter((entry) => strategyEngine(entry) === nextEngine)
      if (pool.length === 0) return
      const currentValid = pool.some((entry) => entry.name === strategy)
      if (!currentValid) {
        const next = pool[0]
        setStrategy(next.name)
        setStrategyParams(defaultParamsFromSpecs(next.params))
      }
    },
    [strategies, strategy],
  )

  const handleStrategyChange = useCallback(
    (nextStrategy: string) => {
      setStrategy(nextStrategy)
      const info = strategies.find((entry) => entry.name === nextStrategy)
      if (info) {
        setStrategyParams(defaultParamsFromSpecs(info.params))
      }
    },
    [strategies],
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
      setStrategy(custom.base_strategy)
      const baseInfo = strategies.find((entry) => entry.name === custom.base_strategy)
      if (baseInfo) {
        setStrategyParams(mergeParamValues(baseInfo.params, custom.parameters))
      } else {
        setStrategyParams(custom.parameters)
      }
      setAuthoringError(null)
      paramsInitialized.current = true
    },
    [strategies],
  )

  const saveCustomPayload = useCallback(
    (payload: CustomStrategy) => {
      setAuthoringError(null)
      saveCustomStrategy.mutate(payload, {
        onSuccess: () => {
          setLoadedCustomName(payload.name)
          setCustomName(payload.name)
          setDescription(payload.description ?? '')
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
      base_strategy: strategy,
      description: description.trim(),
      parameters: strategyParams,
    })
  }, [
    builtInStrategies,
    customName,
    customNames,
    description,
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

  const formInvalid = dateRangeInvalid || !positionSizingValidation.valid || !costValidation.valid

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
    dayTrade,
    dayTradeStartTime,
    dayTradeEndTime,
    dayTradeCloseTime,
    engine,
    displayTimeframe,
    tickFlags,
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
    updateSizingField,
  }

  const validation: BacktestConfigValidation = {
    dateRangeInvalid,
    positionSizingValidation,
    costValidation,
    formInvalid,
    sizingErrors: positionSizingValidation.errors,
    costErrors: costValidation.errors,
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
    selectedStrategy,
    strategiesLoading,
    entryParamSpecs,
    exitParamSpecs,
    exitCatalog: exitCatalog as ExitRuleCatalogResponse | undefined,
    exitCatalogLoading,
    customStrategies: customStrategies ?? [],
    customLoading,
    validation,
    buildRequest,
    authoring,
  }
}
