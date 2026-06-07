import { InstrumentConfigFields } from '@/components/shared/InstrumentConfigFields'
import { MA_TYPES, type MaType } from '@/lib/backtesting/maTypes'

import {
  fieldErrorClass,
  FormSection,
  labelClass,
  panelClass,
  RangeRow,
} from '@/components/optimize/optimizeFormShared'

type OptimizeStrategySectionProps = {
  open: boolean
  onToggle: () => void
  symbol: string
  setSymbol: (v: string) => void
  timeframe: string
  setTimeframe: (v: string) => void
  startDate: Date
  setStartDate: (v: Date) => void
  endDate: Date
  setEndDate: (v: Date) => void
  capital: number
  setCapital: (v: number) => void
  pointValue: number
  setPointValue: (v: number) => void
  shortLow: number
  shortHigh: number
  setShortLow: (v: number) => void
  setShortHigh: (v: number) => void
  longLow: number
  longHigh: number
  setLongLow: (v: number) => void
  setLongHigh: (v: number) => void
  thresholdLow: number
  thresholdHigh: number
  setThresholdLow: (v: number) => void
  setThresholdHigh: (v: number) => void
  shortMaChoices: MaType[]
  setShortMaChoices: (v: MaType[]) => void
  longMaChoices: MaType[]
  setLongMaChoices: (v: MaType[]) => void
  maChoicesInvalid: boolean
}

function toggleMaChoice(value: MaType, list: MaType[], setList: (v: MaType[]) => void) {
  setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
}

export function OptimizeStrategySection({
  open,
  onToggle,
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
  shortLow,
  shortHigh,
  setShortLow,
  setShortHigh,
  longLow,
  longHigh,
  setLongLow,
  setLongHigh,
  thresholdLow,
  thresholdHigh,
  setThresholdLow,
  setThresholdHigh,
  shortMaChoices,
  setShortMaChoices,
  longMaChoices,
  setLongMaChoices,
  maChoicesInvalid,
}: OptimizeStrategySectionProps) {
  return (
    <FormSection title="Strategy" open={open} onToggle={onToggle}>
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

      <div className={panelClass}>
        <RangeRow
          label="Short Period"
          low={shortLow}
          high={shortHigh}
          setLow={setShortLow}
          setHigh={setShortHigh}
          step="1"
        />
        <RangeRow
          label="Long Period"
          low={longLow}
          high={longHigh}
          setLow={setLongLow}
          setHigh={setLongHigh}
          step="1"
        />
        <RangeRow
          label="Threshold"
          low={thresholdLow}
          high={thresholdHigh}
          setLow={setThresholdLow}
          setHigh={setThresholdHigh}
          step="0.01"
        />
        <div className="space-y-1">
          <label className={labelClass}>Short MA Types</label>
          <div className="flex flex-wrap gap-1.5">
            {MA_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleMaChoice(t.value, shortMaChoices, setShortMaChoices)}
                className={
                  shortMaChoices.includes(t.value)
                    ? 'text-brass-400 border-brass-500/50 rounded border px-2 py-0.5 text-xs font-medium'
                    : 'text-silver-300 border-carbon-600/60 hover:border-brass-500/50 rounded border px-2 py-0.5 text-xs font-medium'
                }
              >
                {t.value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Long MA Types</label>
          <div className="flex flex-wrap gap-1.5">
            {MA_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleMaChoice(t.value, longMaChoices, setLongMaChoices)}
                className={
                  longMaChoices.includes(t.value)
                    ? 'text-brass-400 border-brass-500/50 rounded border px-2 py-0.5 text-xs font-medium'
                    : 'text-silver-300 border-carbon-600/60 hover:border-brass-500/50 rounded border px-2 py-0.5 text-xs font-medium'
                }
              >
                {t.value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {maChoicesInvalid && (
          <p className={fieldErrorClass}>Select at least one MA type for each.</p>
        )}
      </div>
    </FormSection>
  )
}
