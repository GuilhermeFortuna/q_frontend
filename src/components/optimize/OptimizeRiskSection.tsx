import {
  FormSection,
  inputClass,
  panelClass,
  RangeRow,
  type RiskMode,
  sectionTitleClass,
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
        ) : (
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
        )}
      </div>
    </FormSection>
  )
}
