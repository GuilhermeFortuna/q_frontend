import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useStrategies } from '@/api/queries/strategies'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  fieldErrorClass,
  inputClass,
  InstrumentConfigFields,
} from '@/components/shared/InstrumentConfigFields'
import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import {
  buildPositionSizingPayload,
  validatePositionSizing,
  type PositionSizingMode,
} from '@/lib/backtesting/positionSizing'
import {
  defaultParamsFromSpecs,
  mergeParamValues,
  type StrategyParamValue,
} from '@/lib/strategies/strategyParams'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'

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
  const [quantity, setQuantity] = useState(1)
  const [safetyMargin, setSafetyMargin] = useState(5000)
  const [minContracts, setMinContracts] = useState(1)
  const [maxContractsInput, setMaxContractsInput] = useState('')
  const [strategy, setStrategy] = useState('MACrossover')
  const [strategyParams, setStrategyParams] = useState<Record<string, StrategyParamValue>>({})

  const { data: strategiesData, isLoading: strategiesLoading } = useStrategies()
  const strategies = useMemo(() => strategiesData?.strategies ?? [], [strategiesData?.strategies])
  const selectedStrategy = strategies.find((entry) => entry.name === strategy)
  const paramsInitialized = useRef(false)

  const pendingBacktestConfig = useAppStore((s) => s.pendingBacktestConfig)
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)

  useEffect(() => {
    if (strategies.length === 0 || paramsInitialized.current) return
    const info = strategies.find((entry) => entry.name === strategy) ?? strategies[0]
    if (!strategies.some((entry) => entry.name === strategy)) {
      setStrategy(info.name)
    }
    setStrategyParams(defaultParamsFromSpecs(info.params))
    paramsInitialized.current = true
  }, [strategies, strategy])

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

    const ps = cfg.position_sizing
    if (ps?.type === 'fixed_quantity') {
      setSizingMode('fixed_quantity')
      setQuantity(ps.quantity)
    } else if (ps?.type === 'fixed_safety_margin') {
      setSizingMode('fixed_safety_margin')
      setSafetyMargin(ps.safety_margin_per_contract)
      setMinContracts(ps.min_contracts)
      setMaxContractsInput(ps.max_contracts != null ? String(ps.max_contracts) : '')
    }

    setPendingBacktestConfig(null)
  }, [pendingBacktestConfig, setPendingBacktestConfig, strategies, strategy, selectedStrategy])

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

  const positionSizingFields = useMemo(
    () => ({
      quantity,
      safetyMargin,
      minContracts,
      maxContractsInput,
    }),
    [quantity, safetyMargin, minContracts, maxContractsInput],
  )

  const positionSizingValidation = useMemo(
    () => validatePositionSizing(sizingMode, positionSizingFields),
    [sizingMode, positionSizingFields],
  )

  const formInvalid = dateRangeInvalid || !positionSizingValidation.valid

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formInvalid) return

    onSubmit({
      symbol,
      timeframe,
      start: startOfDay(startDate).toISOString(),
      end: endOfDay(endDate).toISOString(),
      initial_capital: capital,
      point_value: pointValue,
      position_sizing: buildPositionSizingPayload(sizingMode, positionSizingFields),
      strategy,
      strategy_params: strategyParams,
    })
  }

  const sizingErrors = positionSizingValidation.errors

  return (
    <Card className="quant-panel border-carbon-600/60 flex w-full flex-shrink-0 flex-col overflow-hidden p-5 md:h-full md:max-h-full md:w-80">
      <div className="mb-6 shrink-0">
        <h2 className="text-brass-400 text-xl font-bold">Backtest Engine</h2>
        <p className="text-silver-400 mt-1 text-xs">Configure and run strategy simulations.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          />

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
            </select>

            {sizingMode === 'fixed_quantity' ? (
              <div className="bg-carbon-900/50 border-carbon-600/40 space-y-1 rounded-lg border p-3">
                <label htmlFor="position-quantity" className="text-silver-400 text-xs">
                  Quantity
                </label>
                <input
                  id="position-quantity"
                  type="number"
                  step="1"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={inputClass}
                />
                {sizingErrors.quantity && (
                  <p className={fieldErrorClass}>{sizingErrors.quantity}</p>
                )}
              </div>
            ) : (
              <div className="bg-carbon-900/50 border-carbon-600/40 space-y-3 rounded-lg border p-3">
                <div className="space-y-1">
                  <label className="text-silver-400 text-xs">Safety Margin per Contract</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={safetyMargin}
                    onChange={(e) => setSafetyMargin(Number(e.target.value))}
                    className={inputClass}
                  />
                  {sizingErrors.safety_margin_per_contract && (
                    <p className={fieldErrorClass}>{sizingErrors.safety_margin_per_contract}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-silver-400 text-xs">Min Contracts</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={minContracts}
                    onChange={(e) => setMinContracts(Number(e.target.value))}
                    className={inputClass}
                  />
                  {sizingErrors.min_contracts && (
                    <p className={fieldErrorClass}>{sizingErrors.min_contracts}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-silver-400 text-xs">Max Contracts (optional)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={maxContractsInput}
                    onChange={(e) => setMaxContractsInput(e.target.value)}
                    className={inputClass}
                    placeholder="No limit"
                  />
                  {sizingErrors.max_contracts && (
                    <p className={fieldErrorClass}>{sizingErrors.max_contracts}</p>
                  )}
                </div>
              </div>
            )}
          </div>

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
              disabled={strategiesLoading || strategies.length === 0}
            >
              {strategies.map((entry) => (
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
