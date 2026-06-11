import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useStrategies } from '@/api/queries/strategies'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { inputClass, InstrumentConfigFields } from '@/components/shared/InstrumentConfigFields'
import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { PositionSizingModeFields } from '@/components/shared/PositionSizingModeFields'
import { TransactionCostFields } from '@/components/shared/TransactionCostFields'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import {
  buildPositionSizingPayload,
  defaultPositionSizingFields,
  hydratePositionSizingFields,
  validatePositionSizing,
  type PositionSizingMode,
} from '@/lib/backtesting/positionSizing'
import {
  buildCostsPayload,
  defaultTransactionCostFields,
  hydrateTransactionCostFields,
  validateTransactionCosts,
} from '@/lib/backtesting/transactionCosts'
import {
  defaultParamsFromSpecs,
  mergeParamValues,
  type StrategyParamValue,
} from '@/lib/strategies/strategyParams'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'
import type { StrategyInfo } from '@/types/strategies'

type BacktestEngine = 'candle' | 'tick'

const DISPLAY_TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'H1'] as const

function strategyEngine(info: StrategyInfo): BacktestEngine {
  return info.engine ?? 'candle'
}

type BacktestConfigFormProps = {
  loading: boolean
  error: string | null
  onSubmit: (request: BacktestRequest) => void
}

export function BacktestConfigForm({ loading, error, onSubmit }: BacktestConfigFormProps) {
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

  const { data: strategiesData, isLoading: strategiesLoading } = useStrategies()
  const strategies = useMemo(() => strategiesData?.strategies ?? [], [strategiesData?.strategies])
  const filteredStrategies = useMemo(
    () => strategies.filter((entry) => strategyEngine(entry) === engine),
    [strategies, engine],
  )
  const selectedStrategy = filteredStrategies.find((entry) => entry.name === strategy)
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

  // Hydrate from a config staged by the Optimizer ("Load into Backtest"), then clear it.
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
      setStrategyParams(mergeParamValues(strategyInfo.params, cfg.strategy_params))
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

  const handleEngineChange = (nextEngine: BacktestEngine) => {
    setEngine(nextEngine)
    const pool = strategies.filter((entry) => strategyEngine(entry) === nextEngine)
    if (pool.length === 0) return
    const currentValid = pool.some((entry) => entry.name === strategy)
    if (!currentValid) {
      const next = pool[0]
      setStrategy(next.name)
      setStrategyParams(defaultParamsFromSpecs(next.params))
    }
  }

  const handleStrategyChange = (nextStrategy: string) => {
    setStrategy(nextStrategy)
    const info = strategies.find((entry) => entry.name === nextStrategy)
    if (info) {
      setStrategyParams(defaultParamsFromSpecs(info.params))
    }
  }

  const handleParamChange = (name: string, value: StrategyParamValue) => {
    setStrategyParams((current) => ({ ...current, [name]: value }))
  }

  const dateRangeInvalid = startDate >= endDate

  const positionSizingValidation = useMemo(
    () => validatePositionSizing(sizingMode, positionSizingFields),
    [sizingMode, positionSizingFields],
  )

  const costValidation = useMemo(() => validateTransactionCosts(costFields), [costFields])

  const formInvalid = dateRangeInvalid || !positionSizingValidation.valid || !costValidation.valid

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formInvalid) return

    onSubmit({
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
    })
  }

  const sizingErrors = positionSizingValidation.errors
  const costErrors = costValidation.errors

  const updateSizingField = <K extends keyof typeof positionSizingFields>(
    key: K,
    value: (typeof positionSizingFields)[K],
  ) => {
    setPositionSizingFields((current) => ({ ...current, [key]: value }))
  }

  return (
    <Card className="quant-panel border-carbon-600/60 flex w-full flex-shrink-0 flex-col overflow-hidden p-5 md:h-full md:max-h-full md:w-80">
      <div className="mb-6 shrink-0">
        <h2 className="text-brass-400 text-xl font-bold">Backtest Engine</h2>
        <p className="text-silver-400 mt-1 text-xs">Configure and run strategy simulations.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor="backtest-engine" className="text-silver-200 text-sm font-medium">
              Engine
            </label>
            <select
              id="backtest-engine"
              value={engine}
              onChange={(e) => handleEngineChange(e.target.value as BacktestEngine)}
              className={inputClass}
            >
              <option value="candle">Candle</option>
              <option value="tick">Tick</option>
            </select>
          </div>

          <InstrumentConfigFields
            symbol={symbol}
            setSymbol={setSymbol}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            capital={capital}
            setCapital={setCapital}
            pointValue={pointValue}
            setPointValue={setPointValue}
            dayTrade={dayTrade}
            setDayTrade={setDayTrade}
            dayTradeStartTime={dayTradeStartTime}
            setDayTradeStartTime={setDayTradeStartTime}
            dayTradeEndTime={dayTradeEndTime}
            setDayTradeEndTime={setDayTradeEndTime}
            dayTradeCloseTime={dayTradeCloseTime}
            setDayTradeCloseTime={setDayTradeCloseTime}
            showTimeframe={engine === 'candle'}
          />

          {engine === 'tick' ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="display-timeframe" className="text-silver-200 text-sm font-medium">
                  Display Timeframe
                </label>
                <p className="text-silver-400 text-xs">
                  Chart bar size — does not affect tick data.
                </p>
                <select
                  id="display-timeframe"
                  value={displayTimeframe}
                  onChange={(e) => setDisplayTimeframe(e.target.value)}
                  className={inputClass}
                >
                  {DISPLAY_TIMEFRAME_OPTIONS.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="tick-source" className="text-silver-200 text-sm font-medium">
                  Tick Source
                </label>
                <select
                  id="tick-source"
                  value={tickFlags}
                  onChange={(e) => setTickFlags(e.target.value as 'all' | 'trade')}
                  className={inputClass}
                >
                  <option value="all">All ticks</option>
                  <option value="trade">Trades only</option>
                </select>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-silver-200 text-sm font-medium">Risk Model</h3>
            <label htmlFor="position-sizing" className="text-silver-400 text-xs">
              Position Sizing
            </label>
            <select
              id="position-sizing"
              value={sizingMode}
              onChange={(e) => setSizingMode(e.target.value as PositionSizingMode)}
              className={inputClass}
            >
              <option value="fixed_quantity">Fixed Quantity</option>
              <option value="fixed_safety_margin">Fixed Safety Margin</option>
              <option value="inverse_volatility">Inverse volatility (vol targeting)</option>
            </select>

            <PositionSizingModeFields
              mode={sizingMode}
              fields={positionSizingFields}
              setQuantity={(value) => updateSizingField('quantity', value)}
              setSafetyMargin={(value) => updateSizingField('safetyMargin', value)}
              setMinContracts={(value) => updateSizingField('minContracts', value)}
              setMaxContractsInput={(value) => updateSizingField('maxContractsInput', value)}
              setTargetVolatilityPct={(value) => updateSizingField('targetVolatilityPct', value)}
              setInverseMinContracts={(value) => updateSizingField('inverseMinContracts', value)}
              setInverseMaxContractsInput={(value) =>
                updateSizingField('inverseMaxContractsInput', value)
              }
              errors={sizingErrors}
            />
          </div>

          <TransactionCostFields
            costPerContract={costFields.costPerContract}
            setCostPerContract={(value) =>
              setCostFields((current) => ({ ...current, costPerContract: value }))
            }
            costBps={costFields.costBps}
            setCostBps={(value) => setCostFields((current) => ({ ...current, costBps: value }))}
            errors={costErrors}
          />

          <div className="bg-carbon-600/60 my-4 h-px w-full" />

          <div className="space-y-2">
            <label htmlFor="backtest-strategy" className="text-silver-200 text-sm font-medium">
              Strategy
            </label>
            <select
              id="backtest-strategy"
              value={strategy}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className={inputClass}
              disabled={strategiesLoading || filteredStrategies.length === 0}
            >
              {filteredStrategies.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>

          {selectedStrategy && (
            <StrategyParamFields
              params={selectedStrategy.params}
              values={strategyParams}
              onChange={handleParamChange}
            />
          )}

          <Button
            type="submit"
            disabled={loading || formInvalid || strategiesLoading}
            variant="brass"
            className="mt-4 w-full"
          >
            {loading ? 'Running...' : 'Run Simulation'}
          </Button>

          {error && (
            <div className="mt-4 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs break-words text-rose-400">
              {error}
            </div>
          )}
        </form>
      </div>
    </Card>
  )
}
