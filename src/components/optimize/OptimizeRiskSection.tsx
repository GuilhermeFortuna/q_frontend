import {
  FormSection,
  inputClass,
  RangeRow,
  type RiskMode,
  fieldErrorClass,
} from '@/components/optimize/optimizeFormShared'

type OptimizeRiskSectionProps = {
  open: boolean
  onToggle: () => void
  riskMode: RiskMode
  setRiskMode: (v: RiskMode) => void
  qtyLow: number
  qtyHigh: number
  setQtyLow: (v: number) => void
  setQtyHigh: (v: number) => void
  marginLow: number
  marginHigh: number
  setMarginLow: (v: number) => void
  setMarginHigh: (v: number) => void
  minContractsLow: number
  minContractsHigh: number
  setMinContractsLow: (v: number) => void
  setMinContractsHigh: (v: number) => void
  targetVolLow: number
  targetVolHigh: number
  setTargetVolLow: (v: number) => void
  setTargetVolHigh: (v: number) => void
  inverseMinContractsLow: number
  inverseMinContractsHigh: number
  setInverseMinContractsLow: (v: number) => void
  setInverseMinContractsHigh: (v: number) => void
  inverseMaxContractsInput: string
  setInverseMaxContractsInput: (v: string) => void
  costPerContract: number
  setCostPerContract: (v: number) => void
  costBps: number
  setCostBps: (v: number) => void
  costErrors?: Partial<Record<'costPerContract' | 'costBps', string>>
}

export function OptimizeRiskSection({
  open,
  onToggle,
  riskMode,
  setRiskMode,
  qtyLow,
  qtyHigh,
  setQtyLow,
  setQtyHigh,
  marginLow,
  marginHigh,
  setMarginLow,
  setMarginHigh,
  minContractsLow,
  minContractsHigh,
  setMinContractsLow,
  setMinContractsHigh,
  targetVolLow,
  targetVolHigh,
  setTargetVolLow,
  setTargetVolHigh,
  inverseMinContractsLow,
  inverseMinContractsHigh,
  setInverseMinContractsLow,
  setInverseMinContractsHigh,
  inverseMaxContractsInput,
  setInverseMaxContractsInput,
  costPerContract,
  setCostPerContract,
  costBps,
  setCostBps,
  costErrors = {},
}: OptimizeRiskSectionProps) {
  return (
    <FormSection title="Risk Model & Costs" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-silver-300 text-xs font-semibold">Position Sizing Model</label>
          <select
            value={riskMode}
            onChange={(e) => setRiskMode(e.target.value as RiskMode)}
            className={inputClass}
          >
            <option value="fixed_quantity">Fixed Quantity</option>
            <option value="fixed_safety_margin">Fixed Safety Margin</option>
            <option value="inverse_volatility">Inverse volatility (vol targeting)</option>
          </select>
        </div>

        <div className="bg-carbon-950/30 space-y-3 rounded-lg p-2.5">
          {riskMode === 'fixed_quantity' ? (
            <RangeRow
              label="Quantity"
              low={qtyLow}
              high={qtyHigh}
              setLow={setQtyLow}
              setHigh={setQtyHigh}
              step="0.1"
            />
          ) : riskMode === 'fixed_safety_margin' ? (
            <div className="space-y-3">
              <RangeRow
                label="Safety Margin / Contract"
                low={marginLow}
                high={marginHigh}
                setLow={setMarginLow}
                setHigh={setMarginHigh}
                step="1"
              />
              <RangeRow
                label="Min Contracts"
                low={minContractsLow}
                high={minContractsHigh}
                setLow={setMinContractsLow}
                setHigh={setMinContractsHigh}
                step="1"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-silver-400 text-xs leading-normal">
                Requires a strategy that exposes a volatility indicator on each bar (e.g. TSMOM).
                Other strategies may produce zero trades.
              </p>
              <RangeRow
                label="Target volatility (%)"
                low={targetVolLow}
                high={targetVolHigh}
                setLow={setTargetVolLow}
                setHigh={setTargetVolHigh}
                step="0.1"
              />
              <RangeRow
                label="Min Contracts"
                low={inverseMinContractsLow}
                high={inverseMinContractsHigh}
                setLow={setInverseMinContractsLow}
                setHigh={setInverseMinContractsHigh}
                step="1"
              />
              <div className="space-y-1">
                <label className="text-silver-400 text-xs">Max Contracts (optional, fixed)</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={inverseMaxContractsInput}
                  onChange={(e) => setInverseMaxContractsInput(e.target.value)}
                  className={inputClass}
                  placeholder="No limit"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-carbon-600/20 space-y-3 border-t pt-3">
        <div>
          <h3 className="text-silver-200 text-xs font-semibold">Transaction Costs</h3>
          <p className="text-silver-400 mt-0.5 text-[11px] leading-normal">
            Applied per side (entry and exit paid once). Leave at 0 for gross-of-costs runs.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="cost-per-contract" className="text-silver-400 text-[11px]">
              Per contract
            </label>
            <input
              id="cost-per-contract"
              type="number"
              step="0.01"
              min="0"
              value={costPerContract}
              onChange={(e) => setCostPerContract(Number(e.target.value))}
              className={inputClass}
            />
            {costErrors.costPerContract && (
              <p className={fieldErrorClass}>{costErrors.costPerContract}</p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="cost-bps" className="text-silver-400 text-[11px]">
              Bps of notional
            </label>
            <input
              id="cost-bps"
              type="number"
              step="0.01"
              min="0"
              value={costBps}
              onChange={(e) => setCostBps(Number(e.target.value))}
              className={inputClass}
            />
            {costErrors.costBps && <p className={fieldErrorClass}>{costErrors.costBps}</p>}
          </div>
        </div>
      </div>
    </FormSection>
  )
}
