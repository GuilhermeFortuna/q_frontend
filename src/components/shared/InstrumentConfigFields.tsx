import axios from 'axios'
import { endOfDay, format, startOfDay } from 'date-fns'
import { useState } from 'react'

import { fetchOhlcvAvailableRange } from '@/api/queries/market-data'
import { chipClass } from '@/components/ui/chipStyles'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { RangeChips } from '@/components/ui/RangeChips'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import {
  getAllAvailableDateRange,
  getDateRangeFromPreset,
  type DatePreset,
} from '@/lib/backtesting/dateRange'
import { cn } from '@/lib/utils'

export const inputClass = wellInputClass

export const fieldErrorClass = 'text-xs font-medium text-rose-400 mt-1'

/** @deprecated Use RangeChips — kept for callers not yet migrated. */
export const presetButtonClass = chipClass(false)

/** @deprecated Use RangeChips — kept for callers not yet migrated. */
export const presetButtonActiveClass = chipClass(true)

const DATE_PRESETS: { value: DatePreset; label: DatePreset; title: string }[] = [
  { value: '1M', label: '1M', title: 'Last 1 month' },
  { value: '3M', label: '3M', title: 'Last 3 months' },
  { value: '6M', label: '6M', title: 'Last 6 months' },
  { value: '1Y', label: '1Y', title: 'Last 1 year' },
  { value: 'YTD', label: 'YTD', title: 'Year to date' },
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
  dayTrade?: boolean
  setDayTrade?: (value: boolean) => void
  dayTradeStartTime?: string
  setDayTradeStartTime?: (value: string) => void
  dayTradeEndTime?: string
  setDayTradeEndTime?: (value: string) => void
  dayTradeCloseTime?: string
  setDayTradeCloseTime?: (value: string) => void
  showTimeframe?: boolean
}

/**
 * Shared symbol / timeframe / date-range / capital / point-value block used by
 * both the Backtest and Optimize config forms. Owns the date-preset + "All
 * available data" UX internally; the parent owns the underlying field state.
 */
export type DateRangePresetsFieldsProps = {
  startDate: Date
  setStartDate: (value: Date) => void
  endDate: Date
  setEndDate: (value: Date) => void
  symbol: string
  timeframe: string
}

export function DateRangePresetsFields({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  symbol,
  timeframe,
}: DateRangePresetsFieldsProps) {
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
    <LabeledField
      label="Date Range"
      error={allDataError ?? (dateRangeInvalid ? 'Start date must be before end date.' : undefined)}
    >
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <LabeledField label="Start" htmlFor="config-start-date">
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
          </LabeledField>
          <LabeledField label="End" htmlFor="config-end-date">
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
          </LabeledField>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <RangeChips
            options={DATE_PRESETS}
            value={activeDatePreset === 'ALL' ? null : activeDatePreset}
            onSelect={applyPreset}
          />
          <button
            type="button"
            title="Use all OHLCV data available in MetaTrader 5"
            onClick={() => void applyAllAvailableData()}
            disabled={allDataLoading || !symbol.trim()}
            className={cn(
              chipClass(activeDatePreset === 'ALL'),
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {allDataLoading ? '...' : 'All'}
          </button>
        </div>
      </div>
    </LabeledField>
  )
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
  dayTrade = false,
  setDayTrade,
  dayTradeStartTime = '09:00',
  setDayTradeStartTime,
  dayTradeEndTime = '16:00',
  setDayTradeEndTime,
  dayTradeCloseTime = '17:00',
  setDayTradeCloseTime,
  showTimeframe = true,
}: InstrumentConfigFieldsProps) {
  return (
    <div className="space-y-4">
      <div className={cn('grid gap-3', showTimeframe ? 'grid-cols-2' : 'grid-cols-1')}>
        <LabeledField label="Symbol">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="e.g. PETR4"
            required
          />
        </LabeledField>

        {showTimeframe ? (
          <LabeledField label="Timeframe">
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
          </LabeledField>
        ) : null}
      </div>

      <DateRangePresetsFields
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        symbol={symbol}
        timeframe={timeframe}
      />

      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="Initial Capital">
          <NumberInput
            value={capital}
            onChange={setCapital}
            className={inputClass}
            min="1000"
            required
          />
        </LabeledField>

        <LabeledField label="Value / Point">
          <NumberInput
            step="0.01"
            value={pointValue}
            onChange={setPointValue}
            className={inputClass}
            min="0.01"
            required
          />
        </LabeledField>
      </div>

      {setDayTrade ? (
        <div className="border-carbon-600/20 space-y-3 border-t pt-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={dayTrade}
              onChange={(e) => setDayTrade(e.target.checked)}
              className="accent-brass-500 border-carbon-600 bg-carbon-900 text-brass-500 h-4 w-4 rounded"
            />
            <span className="text-silver-200 text-sm font-semibold">Day Trading Mode</span>
          </label>
          <p className="text-silver-400 -mt-2 pl-6 text-xs leading-normal">
            Trades will not carry onto the next trading day.
          </p>

          {dayTrade && setDayTradeStartTime && setDayTradeEndTime && setDayTradeCloseTime ? (
            <div className="surface-well ml-6 space-y-2 rounded-lg p-2.5">
              <div className="grid grid-cols-3 gap-2">
                <LabeledField label="Start">
                  <input
                    type="text"
                    placeholder="09:00"
                    value={dayTradeStartTime}
                    onChange={(e) => setDayTradeStartTime(e.target.value)}
                    className={cn(inputClass, 'text-center text-xs')}
                  />
                </LabeledField>
                <LabeledField label="End">
                  <input
                    type="text"
                    placeholder="16:00"
                    value={dayTradeEndTime}
                    onChange={(e) => setDayTradeEndTime(e.target.value)}
                    className={cn(inputClass, 'text-center text-xs')}
                  />
                </LabeledField>
                <LabeledField label="Close">
                  <input
                    type="text"
                    placeholder="17:00"
                    value={dayTradeCloseTime}
                    onChange={(e) => setDayTradeCloseTime(e.target.value)}
                    className={cn(inputClass, 'text-center text-xs')}
                  />
                </LabeledField>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
