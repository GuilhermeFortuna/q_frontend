import axios from 'axios'
import { endOfDay, format, startOfDay } from 'date-fns'
import { useMemo, useState } from 'react'

import { fetchOhlcvAvailableRange } from '@/api/queries/market-data'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  defaultBacktestEnd,
  defaultBacktestStart,
  getAllAvailableDateRange,
  getDateRangeFromPreset,
  type DatePreset,
} from '@/lib/backtesting/dateRange'
import {
  buildPositionSizingPayload,
  validatePositionSizing,
  type PositionSizingMode,
} from '@/lib/backtesting/positionSizing'
import { DEFAULT_MA_TYPE, MA_TYPES, type MaType } from '@/lib/backtesting/maTypes'
import type { BacktestRequest } from '@/types/backtesting'

const DATE_PRESETS: { label: DatePreset; title: string }[] = [
  { label: '1M', title: 'Last 1 month' },
  { label: '3M', title: 'Last 3 months' },
  { label: '6M', title: 'Last 6 months' },
  { label: '1Y', title: 'Last 1 year' },
  { label: 'YTD', title: 'Year to date' },
]

const presetButtonClass =
  'text-silver-300 border-carbon-600/60 hover:border-brass-500/50 hover:text-brass-400 rounded border px-2 py-0.5 text-xs font-medium transition-colors'

const presetButtonActiveClass =
  'text-brass-400 border-brass-500/50 rounded border px-2 py-0.5 text-xs font-medium'

const inputClass =
  'w-full bg-carbon-900 border border-carbon-600/60 rounded-md px-3 py-2 text-sm text-silver-100 focus:outline-none focus:ring-2 focus:ring-brass-500/50'

const fieldErrorClass = 'text-xs text-rose-400'

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
  const [activeDatePreset, setActiveDatePreset] = useState<DatePreset | 'ALL' | null>(null)
  const [allDataLoading, setAllDataLoading] = useState(false)
  const [allDataError, setAllDataError] = useState<string | null>(null)

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

  const applyPreset = (preset: DatePreset) => {
    const { start, end } = getDateRangeFromPreset(preset)
    setStartDate(start)
    setEndDate(end)
    setActiveDatePreset(preset)
    setAllDataError(null)
  }

  const applyAllAvailableData = async () => {
    setAllDataLoading(true)
    setAllDataError(null)
    try {
      const range = await fetchOhlcvAvailableRange(symbol, timeframe)
      const { start, end } = getAllAvailableDateRange(range.start)
      setStartDate(start)
      setEndDate(end)
      setActiveDatePreset('ALL')
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Failed to load available data range'
      setAllDataError(message)
    } finally {
      setAllDataLoading(false)
    }
  }

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
          <div className="space-y-2">
            <label className="text-silver-200 text-sm font-medium">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className={inputClass}
              placeholder="e.g. PETR4"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-silver-200 text-sm font-medium">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className={inputClass}
            >
              <option value="M1">1 Minute</option>
              <option value="M5">5 Minutes</option>
              <option value="M15">15 Minutes</option>
              <option value="H1">1 Hour</option>
              <option value="D1">1 Day</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-silver-200 text-sm font-medium">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="backtest-start-date" className="text-silver-400 text-xs">
                  Start
                </label>
                <input
                  id="backtest-start-date"
                  type="date"
                  value={format(startDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    setStartDate(startOfDay(new Date(e.target.value + 'T00:00:00')))
                    setActiveDatePreset(null)
                    setAllDataError(null)
                  }}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label htmlFor="backtest-end-date" className="text-silver-400 text-xs">
                  End
                </label>
                <input
                  id="backtest-end-date"
                  type="date"
                  value={format(endDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    setEndDate(endOfDay(new Date(e.target.value + 'T00:00:00')))
                    setActiveDatePreset(null)
                    setAllDataError(null)
                  }}
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {DATE_PRESETS.map(({ label, title }) => (
                <button
                  key={label}
                  type="button"
                  title={title}
                  onClick={() => applyPreset(label)}
                  className={
                    activeDatePreset === label ? presetButtonActiveClass : presetButtonClass
                  }
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                title="Use all OHLCV data available in MetaTrader 5"
                onClick={() => void applyAllAvailableData()}
                disabled={allDataLoading || !symbol.trim()}
                className={
                  activeDatePreset === 'ALL'
                    ? presetButtonActiveClass
                    : `${presetButtonClass} disabled:cursor-not-allowed disabled:opacity-50`
                }
              >
                {allDataLoading ? '...' : 'All'}
              </button>
            </div>
            {allDataError && <p className={fieldErrorClass}>{allDataError}</p>}
            {dateRangeInvalid && (
              <p className={fieldErrorClass}>Start date must be before end date.</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-silver-200 text-sm font-medium">Initial Capital</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className={inputClass}
              min="1000"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-silver-200 text-sm font-medium">Value per Point</label>
            <input
              type="number"
              step="0.01"
              value={pointValue}
              onChange={(e) => setPointValue(Number(e.target.value))}
              className={inputClass}
              min="0.01"
              required
            />
          </div>

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
