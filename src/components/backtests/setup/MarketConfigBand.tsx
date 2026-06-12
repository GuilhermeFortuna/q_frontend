import { inputClass, InstrumentConfigFields } from '@/components/shared/InstrumentConfigFields'
import { PositionSizingModeFields } from '@/components/shared/PositionSizingModeFields'
import { TransactionCostFields } from '@/components/shared/TransactionCostFields'
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
        'border-carbon-600/40 bg-carbon-950/30 space-y-2 rounded-lg border px-3 py-2.5',
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
    <div className="border-carbon-600/50 bg-carbon-900/20 shrink-0 space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Fieldset legend="Engine" className="min-w-[7rem] flex-1">
          <select
            id="backtest-engine"
            aria-label="Engine"
            value={fields.engine}
            onChange={(e) => setters.handleEngineChange(e.target.value as 'candle' | 'tick')}
            className={inputClass}
          >
            <option value="candle">Candle</option>
            <option value="tick">Tick</option>
          </select>
        </Fieldset>

        <Fieldset legend="Instrument" className="min-w-[12rem] flex-[2]">
          <InstrumentConfigFields
            symbol={fields.symbol}
            setSymbol={setters.setSymbol}
            timeframe={fields.timeframe}
            setTimeframe={setters.setTimeframe}
            startDate={fields.startDate}
            setStartDate={setters.setStartDate}
            endDate={fields.endDate}
            setEndDate={setters.setEndDate}
            capital={fields.capital}
            setCapital={setters.setCapital}
            pointValue={fields.pointValue}
            setPointValue={setters.setPointValue}
            dayTrade={fields.dayTrade}
            setDayTrade={setters.setDayTrade}
            dayTradeStartTime={fields.dayTradeStartTime}
            setDayTradeStartTime={setters.setDayTradeStartTime}
            dayTradeEndTime={fields.dayTradeEndTime}
            setDayTradeEndTime={setters.setDayTradeEndTime}
            dayTradeCloseTime={fields.dayTradeCloseTime}
            setDayTradeCloseTime={setters.setDayTradeCloseTime}
            showTimeframe={fields.engine === 'candle'}
          />
        </Fieldset>

        {fields.engine === 'tick' ? (
          <Fieldset legend="Tick chart" className="min-w-[10rem] flex-1">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="display-timeframe" className="text-silver-400 text-xs">
                  Display TF
                </label>
                <select
                  id="display-timeframe"
                  aria-label="Display Timeframe"
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
                <label htmlFor="tick-source" className="text-silver-400 text-xs">
                  Tick source
                </label>
                <select
                  id="tick-source"
                  aria-label="Tick Source"
                  value={fields.tickFlags}
                  onChange={(e) => setters.setTickFlags(e.target.value as 'all' | 'trade')}
                  className={inputClass}
                >
                  <option value="all">All ticks</option>
                  <option value="trade">Trades only</option>
                </select>
              </div>
            </div>
          </Fieldset>
        ) : null}

        <Fieldset legend="Sizing" className="min-w-[12rem] flex-[2]">
          <div className="space-y-2">
            <label htmlFor="position-sizing" className="text-silver-400 text-xs">
              Mode
            </label>
            <select
              id="position-sizing"
              aria-label="Position Sizing"
              value={fields.sizingMode}
              onChange={(e) => setters.setSizingMode(e.target.value as PositionSizingMode)}
              className={inputClass}
            >
              <option value="fixed_quantity">Fixed Quantity</option>
              <option value="fixed_safety_margin">Fixed Safety Margin</option>
              <option value="inverse_volatility">Inverse volatility (vol targeting)</option>
            </select>
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

        <Fieldset legend="Costs" className="min-w-[10rem] flex-1">
          <TransactionCostFields
            costPerContract={fields.costFields.costPerContract}
            setCostPerContract={(value) =>
              setters.setCostFields((current) => ({ ...current, costPerContract: value }))
            }
            costBps={fields.costFields.costBps}
            setCostBps={(value) =>
              setters.setCostFields((current) => ({ ...current, costBps: value }))
            }
            errors={costErrors}
          />
        </Fieldset>
      </div>

      {validation.dateRangeInvalid ? (
        <p className="text-xs font-medium text-rose-400">Start date must be before end date.</p>
      ) : null}
    </div>
  )
}
