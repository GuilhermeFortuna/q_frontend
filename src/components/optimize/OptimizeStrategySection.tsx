import { InstrumentConfigFields } from '@/components/shared/InstrumentConfigFields'
import { StrategySearchSpaceFields } from '@/components/optimize/StrategySearchSpaceFields'
import type { SearchSpaceFieldState } from '@/lib/strategies/strategyParams'
import type { StrategyInfo } from '@/types/strategies'

import { FormSection, inputClass } from '@/components/optimize/optimizeFormShared'

type OptimizeStrategySectionProps = {
  open: boolean
  onToggle: () => void
  strategies: StrategyInfo[]
  strategiesLoading: boolean
  strategy: string
  onStrategyChange: (strategy: string) => void
  searchSpace: Record<string, SearchSpaceFieldState>
  onSearchSpaceChange: (name: string, field: SearchSpaceFieldState) => void
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
}

export function OptimizeStrategySection({
  open,
  onToggle,
  strategies,
  strategiesLoading,
  strategy,
  onStrategyChange,
  searchSpace,
  onSearchSpaceChange,
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
}: OptimizeStrategySectionProps) {
  const selectedStrategy = strategies.find((entry) => entry.name === strategy)

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

      <div className="space-y-1">
        <label htmlFor="optimize-strategy" className="text-silver-200 text-sm font-medium">
          Strategy
        </label>
        <select
          id="optimize-strategy"
          value={strategy}
          onChange={(e) => onStrategyChange(e.target.value)}
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
        <StrategySearchSpaceFields
          params={selectedStrategy.params}
          state={searchSpace}
          onChange={onSearchSpaceChange}
        />
      )}
    </FormSection>
  )
}
