import { endOfDay, format, startOfDay } from 'date-fns'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  defaultBacktestEnd,
  defaultBacktestStart,
  getDateRangeFromPreset,
  type DatePreset,
} from '@/lib/backtesting/dateRange'
import type { BacktestRequest } from '@/types/backtesting'

const DATE_PRESETS: { label: DatePreset; title: string }[] = [
  { label: '1M', title: 'Last 1 month' },
  { label: '3M', title: 'Last 3 months' },
  { label: '6M', title: 'Last 6 months' },
  { label: '1Y', title: 'Last 1 year' },
  { label: 'YTD', title: 'Year to date' },
]

const inputClass =
  'w-full bg-carbon-900 border border-carbon-600/60 rounded-md px-3 py-2 text-sm text-silver-100 focus:outline-none focus:ring-2 focus:ring-brass-500/50'

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
  const [strategy, setStrategy] = useState('MACrossover')
  const [shortPeriod, setShortPeriod] = useState(50)
  const [longPeriod, setLongPeriod] = useState(200)
  const [threshold, setThreshold] = useState(0.0)

  const dateRangeInvalid = startDate >= endDate

  const applyPreset = (preset: DatePreset) => {
    const { start, end } = getDateRangeFromPreset(preset)
    setStartDate(start)
    setEndDate(end)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (dateRangeInvalid) return

    onSubmit({
      symbol,
      timeframe,
      start: startOfDay(startDate).toISOString(),
      end: endOfDay(endDate).toISOString(),
      initial_capital: capital,
      point_value: pointValue,
      strategy,
      strategy_params: {
        short_period: shortPeriod,
        long_period: longPeriod,
        threshold,
      },
    })
  }

  return (
    <Card className="quant-panel border-carbon-600/60 w-full flex-shrink-0 overflow-y-auto p-5 md:w-80">
      <div className="mb-6">
        <h2 className="text-brass-400 text-xl font-bold">Backtest Engine</h2>
        <p className="text-silver-400 mt-1 text-xs">Configure and run strategy simulations.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="text-silver-400 text-xs">Start</label>
              <input
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(startOfDay(new Date(e.target.value + 'T00:00:00')))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="text-silver-400 text-xs">End</label>
              <input
                type="date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(endOfDay(new Date(e.target.value + 'T00:00:00')))}
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
                className="text-silver-300 border-carbon-600/60 hover:border-brass-500/50 hover:text-brass-400 rounded border px-2 py-0.5 text-xs font-medium transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
          {dateRangeInvalid && (
            <p className="text-xs text-rose-400">Start date must be before end date.</p>
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
              <label className="text-silver-400 text-xs">Short Period</label>
              <input
                type="number"
                value={shortPeriod}
                onChange={(e) => setShortPeriod(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-silver-400 text-xs">Long Period</label>
              <input
                type="number"
                value={longPeriod}
                onChange={(e) => setLongPeriod(Number(e.target.value))}
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
          disabled={loading || dateRangeInvalid}
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
    </Card>
  )
}
