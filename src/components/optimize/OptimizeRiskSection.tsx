import {
  FormSection,
  inputClass,
  panelClass,
  RangeRow,
  type RiskMode,
  sectionTitleClass,
} from '@/components/optimize/optimizeFormShared'
import { TransactionCostFields } from '@/components/shared/TransactionCostFields'

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
    <FormSection title="Risk Model" open={open} onToggle={onToggle}>
      <div className="space-y-2">
        <label className={sectionTitleClass}>Position Sizing Model</label>
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
      <div className={panelClass}>
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
          <>
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
          </>
        ) : (
          <>
            <p className="text-silver-400 text-xs">
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
          </>
        )}
      </div>
      <TransactionCostFields
        costPerContract={costPerContract}
        setCostPerContract={setCostPerContract}
        costBps={costBps}
        setCostBps={setCostBps}
        errors={costErrors}
      />
    </FormSection>
  )
}
