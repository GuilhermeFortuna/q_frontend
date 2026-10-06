import { DateRangePresetsFields, inputClass } from '@/components/shared/InstrumentConfigFields'
import { LabeledField } from '@/components/ui/LabeledField'
import { RESEARCH_CANDLE_TIMEFRAME_OPTIONS } from '@/lib/market/timeframes'

type FeatureLabInstrumentFieldsProps = {
  symbol: string
  onSymbolChange: (value: string) => void
  timeframe: string
  onTimeframeChange: (value: string) => void
  startDate: Date
  onStartDateChange: (value: Date) => void
  endDate: Date
  onEndDateChange: (value: Date) => void
}

export function FeatureLabInstrumentFields({
  symbol,
  onSymbolChange,
  timeframe,
  onTimeframeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}: FeatureLabInstrumentFieldsProps) {
  return (
    <div className="space-y-4" data-testid="feature-lab-instrument-fields">
      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="Symbol" htmlFor="feature-lab-symbol">
          <input
            id="feature-lab-symbol"
            type="text"
            value={symbol}
            onChange={(event) => onSymbolChange(event.target.value.toUpperCase())}
            className={inputClass}
            placeholder="e.g. EURUSD"
            required
          />
        </LabeledField>

        <LabeledField label="Timeframe" htmlFor="feature-lab-timeframe">
          <select
            id="feature-lab-timeframe"
            value={timeframe}
            onChange={(event) => onTimeframeChange(event.target.value)}
            className={inputClass}
          >
            {RESEARCH_CANDLE_TIMEFRAME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </LabeledField>
      </div>

      <DateRangePresetsFields
        startDate={startDate}
        setStartDate={onStartDateChange}
        endDate={endDate}
        setEndDate={onEndDateChange}
        symbol={symbol}
        timeframe={timeframe}
      />
    </div>
  )
}
