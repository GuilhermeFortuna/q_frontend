import { endOfDay, startOfDay } from 'date-fns'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  fieldErrorClass,
  inputClass,
  InstrumentConfigFields,
} from '@/components/shared/InstrumentConfigFields'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import {
  buildPositionSizingPayload,
  validatePositionSizing,
  type PositionSizingMode,
} from '@/lib/backtesting/positionSizing'
import { DEFAULT_MA_TYPE, MA_TYPES, type MaType } from '@/lib/backtesting/maTypes'
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
  const [shortPeriod, setShortPeriod] = useState(50)
  const [longPeriod, setLongPeriod] = useState(200)
  const [shortMaType, setShortMaType] = useState<MaType>(DEFAULT_MA_TYPE)
  const [longMaType, setLongMaType] = useState<MaType>(DEFAULT_MA_TYPE)
  const [threshold, setThreshold] = useState(0.0)

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
      strategy_params: {
        short_period: shortPeriod,
        long_period: longPeriod,
        short_ma_type: shortMaType,
        long_ma_type: longMaType,
        threshold,
      },
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
            <label className="text-silver-200 text-sm font-medium">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className={inputClass}
            >
              <option value="MACrossover">MA Crossover</option>
            </select>
          </div>

          {strategy === 'MACrossover' && (
            <div className="bg-carbon-900/50 border-carbon-600/40 space-y-3 rounded-lg border p-3">
              <div className="space-y-1">
                <label className="text-silver-400 text-xs">Short MA Type</label>
                <select
                  value={shortMaType}
                  onChange={(e) => setShortMaType(e.target.value as MaType)}
                  className={inputClass}
                >
                  {MA_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-silver-400 text-xs">Short Period</label>
                <input
                  type="number"
                  value={shortPeriod}
                  onChange={(e) => setShortPeriod(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-silver-400 text-xs">Long MA Type</label>
                <select
                  value={longMaType}
                  onChange={(e) => setLongMaType(e.target.value as MaType)}
                  className={inputClass}
                >
                  {MA_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-silver-400 text-xs">Long Period</label>
                <input
                  type="number"
                  onChange={(e) => setLongPeriod(Number(e.target.value))}
                  value={longPeriod}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-silver-400 text-xs">Threshold</label>
                <input
                  type="number"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || formInvalid}
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
