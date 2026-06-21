import { InstrumentConfigFields } from '@/components/shared/InstrumentConfigFields'
import { StrategySearchSpaceFields } from '@/components/optimize/StrategySearchSpaceFields'
import type { SearchSpaceFieldState } from '@/lib/strategies/strategyParams'
import { strategyOptionLabel } from '@/lib/strategies/strategyPresentation'
import type { StrategyInfo } from '@/types/strategies'

import { FormSection, inputClass } from '@/components/optimize/optimizeFormShared'

type OptimizeEngine = 'candle' | 'tick'

type OptimizeStrategySectionProps = {
  open: boolean
  onToggle: () => void
  strategies: StrategyInfo[]
  strategiesLoading: boolean
  strategy: string
  onStrategyChange: (strategy: string) => void
  engine: OptimizeEngine
  onEngineChange: (engine: OptimizeEngine) => void
  displayTimeframe: string
  onDisplayTimeframeChange: (value: string) => void
  tickFlags: 'all' | 'trade'
  onTickFlagsChange: (value: 'all' | 'trade') => void
  displayTimeframeOptions: readonly string[]
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
  dayTrade: boolean
  setDayTrade: (v: boolean) => void
  dayTradeStartTime: string
  setDayTradeStartTime: (v: string) => void
  dayTradeEndTime: string
  setDayTradeEndTime: (v: string) => void
  dayTradeCloseTime: string
  setDayTradeCloseTime: (v: string) => void
  /** When false, hides engine/tick controls (e.g. walk-forward workspace). */
  showEngineSelector?: boolean
  customStrategyNames?: ReadonlySet<string>
}

export function OptimizeStrategySection({
  open,
  onToggle,
  strategies,
  strategiesLoading,
  strategy,
  onStrategyChange,
  engine,
  onEngineChange,
  displayTimeframe,
  onDisplayTimeframeChange,
  tickFlags,
  onTickFlagsChange,
  displayTimeframeOptions,
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
  dayTrade,
  setDayTrade,
  dayTradeStartTime,
  setDayTradeStartTime,
  dayTradeEndTime,
  setDayTradeEndTime,
  dayTradeCloseTime,
  setDayTradeCloseTime,
  showEngineSelector = true,
  customStrategyNames = new Set<string>(),
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

      {showEngineSelector ? (
        <>
          <div className="space-y-1">
            <label htmlFor="optimize-engine" className="text-silver-200 text-sm font-medium">
              Engine
            </label>
            <select
              id="optimize-engine"
              value={engine}
              onChange={(e) => onEngineChange(e.target.value as OptimizeEngine)}
              className={inputClass}
            >
              <option value="candle">Candle</option>
              <option value="tick">Tick</option>
            </select>
          </div>

          {engine === 'tick' ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="optimize-display-timeframe"
                  className="text-silver-200 text-sm font-medium"
                >
                  Display Timeframe
                </label>
                <p className="text-silver-400 text-xs">
                  Chart bar size — does not affect tick data.
                </p>
                <select
                  id="optimize-display-timeframe"
                  value={displayTimeframe}
                  onChange={(e) => onDisplayTimeframeChange(e.target.value)}
                  className={inputClass}
                >
                  {displayTimeframeOptions.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="optimize-tick-source"
                  className="text-silver-200 text-sm font-medium"
                >
                  Tick Source
                </label>
                <select
                  id="optimize-tick-source"
                  value={tickFlags}
                  onChange={(e) => onTickFlagsChange(e.target.value as 'all' | 'trade')}
                  className={inputClass}
                >
                  <option value="all">All ticks</option>
                  <option value="trade">Trades only</option>
                </select>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

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
              {strategyOptionLabel(entry, customStrategyNames)}
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
