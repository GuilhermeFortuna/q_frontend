import axios from 'axios'
import { endOfDay, format, startOfDay } from 'date-fns'
import { useState } from 'react'

import { fetchOhlcvAvailableRange } from '@/api/queries/market-data'
import {
  getAllAvailableDateRange,
  getDateRangeFromPreset,
  type DatePreset,
} from '@/lib/backtesting/dateRange'

export const inputClass =
  'w-full bg-carbon-900 border border-carbon-600/60 rounded-md px-3 py-2 text-sm text-silver-100 focus:outline-none focus:ring-2 focus:ring-brass-500/50'

export const fieldErrorClass = 'text-xs text-rose-400'

export const presetButtonClass =
  'text-silver-300 border-carbon-600/60 hover:border-brass-500/50 hover:text-brass-400 rounded border px-2 py-0.5 text-xs font-medium transition-colors'

export const presetButtonActiveClass =
  'text-brass-400 border-brass-500/50 rounded border px-2 py-0.5 text-xs font-medium'

const DATE_PRESETS: { label: DatePreset; title: string }[] = [
  { label: '1M', title: 'Last 1 month' },
  { label: '3M', title: 'Last 3 months' },
  { label: '6M', title: 'Last 6 months' },
  { label: '1Y', title: 'Last 1 year' },
  { label: 'YTD', title: 'Year to date' },
]

type InstrumentConfigFieldsProps = {
  symbol: string
  setSymbol: (value: string) => void
  timeframe: string
  setTimeframe: (value: string) => void
  startDate: Date
  setStartDate: (value: Date) => void
  endDate: Date
  setEndDate: (value: Date) => void
  capital: number
  setCapital: (value: number) => void
  pointValue: number
  setPointValue: (value: number) => void
}

/**
 * Shared symbol / timeframe / date-range / capital / point-value block used by
 * both the Backtest and Optimize config forms. Owns the date-preset + "All
 * available data" UX internally; the parent owns the underlying field state.
 */
export function InstrumentConfigFields({
  symbol,
  setSymbol,
  timeframe,
  setTimeframe,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  capital,
  setCapital,
  pointValue,
  setPointValue,
}: InstrumentConfigFieldsProps) {
  const [activeDatePreset, setActiveDatePreset] = useState<DatePreset | 'ALL' | null>(null)
  const [allDataLoading, setAllDataLoading] = useState(false)
  const [allDataError, setAllDataError] = useState<string | null>(null)

  const dateRangeInvalid = startDate >= endDate

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

  return (
    <>
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
            <label htmlFor="config-start-date" className="text-silver-400 text-xs">
              Start
            </label>
            <input
              id="config-start-date"
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
            <label htmlFor="config-end-date" className="text-silver-400 text-xs">
              End
            </label>
            <input
              id="config-end-date"
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
              className={activeDatePreset === label ? presetButtonActiveClass : presetButtonClass}
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
        {dateRangeInvalid && <p className={fieldErrorClass}>Start date must be before end date.</p>}
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
    </>
  )
}
