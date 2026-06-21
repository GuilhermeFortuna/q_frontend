import { inputClass, DateRangePresetsFields } from '@/components/shared/InstrumentConfigFields'
import { PositionSizingModeFields } from '@/components/shared/PositionSizingModeFields'
import { NumberInput } from '@/components/ui/number-input'
import type { PositionSizingMode } from '@/lib/backtesting/positionSizing'
import {
  DISPLAY_TIMEFRAME_OPTIONS,
  type BacktestConfigFields,
  type BacktestConfigSetters,
  type BacktestConfigValidation,
} from '@/lib/backtesting/useBacktestConfig'
import { cn } from '@/lib/utils'

type MarketConfigBandProps = {
  fields: BacktestConfigFields
  setters: BacktestConfigSetters
  validation: BacktestConfigValidation
}

function Fieldset({
  legend,
  children,
  className,
}: {
  legend: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <fieldset
      className={cn(
        'border-carbon-600/40 bg-carbon-950/20 flex flex-col gap-3 rounded-lg border px-3.5 py-3',
        className,
      )}
    >
      <legend className="text-brass-500/90 px-1 text-[10px] font-bold tracking-wider uppercase">
        {legend}
      </legend>
      {children}
    </fieldset>
  )
}

export function MarketConfigBand({ fields, setters, validation }: MarketConfigBandProps) {
  const { sizingErrors, costErrors } = validation

  return (
    <div className="border-carbon-600/50 bg-carbon-900/35 shrink-0 space-y-3 rounded-xl border p-4 shadow-lg">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* COLUMN 1: INSTRUMENT & MODELING */}
        <Fieldset legend="Instrument & Modeling">
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="backtest-engine" className="text-silver-300 text-xs font-medium">
                Engine
              </label>
              <select
                id="backtest-engine"
                value={fields.engine}
                onChange={(e) => setters.handleEngineChange(e.target.value as 'candle' | 'tick')}
                className={inputClass}
              >
                <option value="candle">Candle</option>
                <option value="tick">Tick</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="backtest-symbol" className="text-silver-300 text-xs font-medium">
                Symbol
              </label>
              <input
                id="backtest-symbol"
                type="text"
                value={fields.symbol}
                onChange={(e) => setters.setSymbol(e.target.value.toUpperCase())}
                className={inputClass}
                placeholder="e.g. PETR4"
                required
              />
            </div>

            {fields.engine === 'candle' ? (
              <div className="space-y-1">
                <label htmlFor="backtest-timeframe" className="text-silver-300 text-xs font-medium">
                  Timeframe
                </label>
                <select
                  id="backtest-timeframe"
                  value={fields.timeframe}
                  onChange={(e) => setters.setTimeframe(e.target.value)}
                  className={inputClass}
                >
                  <option value="M1">1 Minute</option>
                  <option value="M5">5 Minutes</option>
                  <option value="M15">15 Minutes</option>
                  <option value="H1">1 Hour</option>
                  <option value="D1">1 Day</option>
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label
                    htmlFor="display-timeframe"
                    className="text-silver-400 text-[10px] font-bold tracking-wider uppercase"
                  >
                    Display TF
                  </label>
                  <select
                    id="display-timeframe"
                    value={fields.displayTimeframe}
                    onChange={(e) => setters.setDisplayTimeframe(e.target.value)}
                    className={inputClass}
                  >
                    {DISPLAY_TIMEFRAME_OPTIONS.map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="tick-source"
                    className="text-silver-400 text-[10px] font-bold tracking-wider uppercase"
                  >
                    Tick Source
                  </label>
                  <select
                    id="tick-source"
                    value={fields.tickFlags}
                    onChange={(e) => setters.setTickFlags(e.target.value as 'all' | 'trade')}
                    className={inputClass}
                  >
                    <option value="all">All ticks</option>
                    <option value="trade">Trades only</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </Fieldset>

        {/* COLUMN 2: DATE RANGE & SCHEDULE */}
        <Fieldset legend="Date Range & Schedule">
          <div className="space-y-3">
            <DateRangePresetsFields
              startDate={fields.startDate}
              setStartDate={setters.setStartDate}
              endDate={fields.endDate}
              setEndDate={setters.setEndDate}
              symbol={fields.symbol}
              timeframe={fields.timeframe}
            />

            <div className="border-carbon-600/20 border-t pt-2.5">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={fields.dayTrade}
                  onChange={(e) => setters.setDayTrade(e.target.checked)}
                  className="accent-brass-500 border-carbon-600 bg-carbon-900 text-brass-500 h-4 w-4 rounded"
                />
                <span className="text-silver-200 text-sm font-medium">Day Trading Mode</span>
              </label>

              {fields.dayTrade ? (
                <div className="bg-carbon-950/40 border-carbon-600/35 mt-2 space-y-2 rounded-lg border p-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="space-y-1 text-center">
                      <label className="text-silver-400 text-[9px] font-bold tracking-wider uppercase">
                        Start
                      </label>
                      <input
                        type="text"
                        placeholder="09:00"
                        value={fields.dayTradeStartTime}
                        onChange={(e) => setters.setDayTradeStartTime(e.target.value)}
                        className="bg-carbon-950/80 border-brass-600/15 text-silver-100 focus:ring-brass-500/50 w-full rounded border py-1 text-center text-xs focus:ring-2 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1 text-center">
                      <label className="text-silver-400 text-[9px] font-bold tracking-wider uppercase">
                        End
                      </label>
                      <input
                        type="text"
                        placeholder="16:00"
                        value={fields.dayTradeEndTime}
                        onChange={(e) => setters.setDayTradeEndTime(e.target.value)}
                        className="bg-carbon-950/80 border-brass-600/15 text-silver-100 focus:ring-brass-500/50 w-full rounded border py-1 text-center text-xs focus:ring-2 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1 text-center">
                      <label className="text-silver-400 text-[9px] font-bold tracking-wider uppercase">
                        Close
                      </label>
                      <input
                        type="text"
                        placeholder="17:00"
                        value={fields.dayTradeCloseTime}
                        onChange={(e) => setters.setDayTradeCloseTime(e.target.value)}
                        className="bg-carbon-950/80 border-brass-600/15 text-silver-100 focus:ring-brass-500/50 w-full rounded border py-1 text-center text-xs focus:ring-2 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-silver-500 mt-1 pl-6 text-[11px] leading-normal">
                  Trades carry over to the next trading day.
                </p>
              )}
            </div>
          </div>
        </Fieldset>

        {/* COLUMN 3: CAPITAL & SIZING */}
        <Fieldset legend="Capital & Sizing">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-silver-300 text-xs font-medium">Capital</label>
                <NumberInput
                  value={fields.capital}
                  onChange={setters.setCapital}
                  className={inputClass}
                  min="1000"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-silver-300 text-xs font-medium">Val/Point</label>
                <NumberInput
                  step="0.01"
                  value={fields.pointValue}
                  onChange={setters.setPointValue}
                  className={inputClass}
                  min="0.01"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="position-sizing" className="text-silver-300 text-xs font-medium">
                Sizing Mode
              </label>
              <select
                id="position-sizing"
                value={fields.sizingMode}
                onChange={(e) => setters.setSizingMode(e.target.value as PositionSizingMode)}
                className={inputClass}
              >
                <option value="fixed_quantity">Fixed Quantity</option>
                <option value="fixed_safety_margin">Fixed Safety Margin</option>
                <option value="inverse_volatility">Vol Targeting</option>
              </select>
            </div>

            <PositionSizingModeFields
              mode={fields.sizingMode}
              fields={fields.positionSizingFields}
              setQuantity={(value) => setters.updateSizingField('quantity', value)}
              setSafetyMargin={(value) => setters.updateSizingField('safetyMargin', value)}
              setMinContracts={(value) => setters.updateSizingField('minContracts', value)}
              setMaxContractsInput={(value) =>
                setters.updateSizingField('maxContractsInput', value)
              }
              setTargetVolatilityPct={(value) =>
                setters.updateSizingField('targetVolatilityPct', value)
              }
              setInverseMinContracts={(value) =>
                setters.updateSizingField('inverseMinContracts', value)
              }
              setInverseMaxContractsInput={(value) =>
                setters.updateSizingField('inverseMaxContractsInput', value)
              }
              errors={sizingErrors}
            />
          </div>
        </Fieldset>

        {/* COLUMN 4: COSTS */}
        <Fieldset legend="Costs">
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="cost-per-contract" className="text-silver-300 text-xs font-medium">
                Cost per contract (per side)
              </label>
              <NumberInput
                id="cost-per-contract"
                step="0.01"
                min="0"
                value={fields.costFields.costPerContract}
                onChange={(costPerContract) =>
                  setters.setCostFields((current) => ({
                    ...current,
                    costPerContract,
                  }))
                }
                emptyOnBlur={0}
                className={inputClass}
              />
              {costErrors.costPerContract && (
                <p className="mt-1 text-xs font-medium text-rose-400">
                  {costErrors.costPerContract}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="cost-bps" className="text-silver-300 text-xs font-medium">
                Cost (bps of notional, per side)
              </label>
              <NumberInput
                id="cost-bps"
                step="0.01"
                min="0"
                value={fields.costFields.costBps}
                onChange={(costBps) =>
                  setters.setCostFields((current) => ({
                    ...current,
                    costBps,
                  }))
                }
                emptyOnBlur={0}
                className={inputClass}
              />
              {costErrors.costBps && (
                <p className="mt-1 text-xs font-medium text-rose-400">{costErrors.costBps}</p>
              )}
            </div>

            <div className="border-carbon-600/20 text-silver-400 border-t pt-2 text-[11px] leading-normal">
              Costs apply per side (entry and exit paid once). Leave at 0 for gross-of-costs
              backtests.
            </div>
          </div>
        </Fieldset>
      </div>

      {validation.dateRangeInvalid && (
        <p className="mt-1 text-xs font-medium text-rose-400">
          Start date must be before end date.
        </p>
      )}
    </div>
  )
}
