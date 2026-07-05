import { DateRangePresetsFields, inputClass } from '@/components/shared/InstrumentConfigFields'
import { RangeRow } from '@/components/optimize/optimizeFormShared'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { normalizeLeadingZero } from '@/lib/numberInput'
import {
  DISPLAY_TIMEFRAME_OPTIONS,
  type OptimizeConfigFields,
  type OptimizeConfigSetters,
  type OptimizeConfigValidation,
} from '@/lib/optimize/useOptimizeConfig'
import { cn } from '@/lib/utils'

type OptimizeMarketConfigBandProps = {
  fields: OptimizeConfigFields
  setters: OptimizeConfigSetters
  validation: OptimizeConfigValidation
}

function ConfigSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Panel living className={cn('flex flex-col gap-3 px-3.5 py-3', className)}>
      <PanelHeader title={title} />
      {children}
    </Panel>
  )
}

export function OptimizeMarketConfigBand({
  fields,
  setters,
  validation,
}: OptimizeMarketConfigBandProps) {
  const { costErrors } = validation

  return (
    <Panel className="shrink-0 space-y-3 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ConfigSection title="Instrument & Modeling">
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="optimize-engine" className="text-silver-300 text-xs font-medium">
                Engine
              </label>
              <select
                id="optimize-engine"
                value={fields.engine}
                onChange={(e) =>
                  setters.handleEngineChange(e.target.value as OptimizeConfigFields['engine'])
                }
                className={inputClass}
              >
                <option value="candle">Candle</option>
                <option value="tick">Tick</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="optimize-symbol" className="text-silver-300 text-xs font-medium">
                Symbol
              </label>
              <input
                id="optimize-symbol"
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
                <label htmlFor="optimize-timeframe" className="text-silver-300 text-xs font-medium">
                  Timeframe
                </label>
                <select
                  id="optimize-timeframe"
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
                    htmlFor="optimize-display-timeframe"
                    className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase"
                  >
                    Display TF
                  </label>
                  <select
                    id="optimize-display-timeframe"
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
                    htmlFor="optimize-tick-source"
                    className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase"
                  >
                    Tick Source
                  </label>
                  <select
                    id="optimize-tick-source"
                    value={fields.tickFlags}
                    onChange={(e) =>
                      setters.setTickFlags(e.target.value as OptimizeConfigFields['tickFlags'])
                    }
                    className={inputClass}
                  >
                    <option value="all">All ticks</option>
                    <option value="trade">Trades only</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </ConfigSection>

        <ConfigSection title="Date Range & Schedule">
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
                      <label className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
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
                      <label className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
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
                      <label className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
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
        </ConfigSection>

        <ConfigSection title="Capital & Sizing">
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
              <label htmlFor="optimize-sizing-mode" className="text-silver-300 text-xs font-medium">
                Sizing Mode
              </label>
              <select
                id="optimize-sizing-mode"
                value={fields.riskMode}
                onChange={(e) =>
                  setters.setRiskMode(e.target.value as OptimizeConfigFields['riskMode'])
                }
                className={inputClass}
              >
                <option value="fixed_quantity">Fixed Quantity</option>
                <option value="fixed_safety_margin">Fixed Safety Margin</option>
                <option value="inverse_volatility">Vol Targeting</option>
              </select>
            </div>

            <div className="surface-well space-y-3 rounded-lg p-2.5">
              {fields.riskMode === 'fixed_quantity' ? (
                <RangeRow
                  label="Quantity"
                  low={fields.qtyLow}
                  high={fields.qtyHigh}
                  setLow={setters.setQtyLow}
                  setHigh={setters.setQtyHigh}
                  step="0.1"
                />
              ) : fields.riskMode === 'fixed_safety_margin' ? (
                <div className="space-y-3">
                  <RangeRow
                    label="Safety Margin / Contract"
                    low={fields.marginLow}
                    high={fields.marginHigh}
                    setLow={setters.setMarginLow}
                    setHigh={setters.setMarginHigh}
                    step="1"
                  />
                  <RangeRow
                    label="Min Contracts"
                    low={fields.minContractsLow}
                    high={fields.minContractsHigh}
                    setLow={setters.setMinContractsLow}
                    setHigh={setters.setMinContractsHigh}
                    step="1"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-silver-400 text-[11px] leading-normal">
                    Requires a strategy that exposes a volatility indicator on each bar.
                  </p>
                  <RangeRow
                    label="Target volatility (%)"
                    low={fields.targetVolLow}
                    high={fields.targetVolHigh}
                    setLow={setters.setTargetVolLow}
                    setHigh={setters.setTargetVolHigh}
                    step="0.1"
                  />
                  <RangeRow
                    label="Min Contracts"
                    low={fields.inverseMinContractsLow}
                    high={fields.inverseMinContractsHigh}
                    setLow={setters.setInverseMinContractsLow}
                    setHigh={setters.setInverseMinContractsHigh}
                    step="1"
                  />
                  <LabeledField label="Max Contracts (optional, fixed)">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={fields.inverseMaxContractsInput}
                      onChange={(e) =>
                        setters.setInverseMaxContractsInput(
                          normalizeLeadingZero(fields.inverseMaxContractsInput, e.target.value),
                        )
                      }
                      className={inputClass}
                      placeholder="No limit"
                    />
                  </LabeledField>
                </div>
              )}
            </div>
          </div>
        </ConfigSection>

        <ConfigSection title="Costs">
          <div className="space-y-3">
            <LabeledField
              label="Cost per contract (per side)"
              htmlFor="optimize-cost-per-contract"
              error={costErrors.costPerContract}
            >
              <NumberInput
                id="optimize-cost-per-contract"
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
            </LabeledField>

            <LabeledField
              label="Cost (bps of notional, per side)"
              htmlFor="optimize-cost-bps"
              error={costErrors.costBps}
            >
              <NumberInput
                id="optimize-cost-bps"
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
            </LabeledField>

            <div className="border-carbon-600/20 text-silver-400 border-t pt-2 text-[11px] leading-normal">
              Costs apply per side (entry and exit paid once). Leave at 0 for gross-of-costs runs.
            </div>
          </div>
        </ConfigSection>
      </div>

      {validation.dateRangeInvalid && (
        <p className="mt-1 text-xs font-medium text-rose-400">
          Start date must be before end date.
        </p>
      )}
    </Panel>
  )
}
