import { fieldErrorClass, inputClass } from '@/components/shared/InstrumentConfigFields'
import type { PositionSizingFields, PositionSizingMode } from '@/lib/backtesting/positionSizing'

type PositionSizingModeFieldsProps = {
  mode: PositionSizingMode
  fields: PositionSizingFields
  setQuantity: (value: number) => void
  setSafetyMargin: (value: number) => void
  setMinContracts: (value: number) => void
  setMaxContractsInput: (value: string) => void
  setTargetVolatilityPct: (value: number) => void
  setInverseMinContracts: (value: number) => void
  setInverseMaxContractsInput: (value: string) => void
  errors?: Partial<Record<string, string>>
}

export function PositionSizingModeFields({
  mode,
  fields,
  setQuantity,
  setSafetyMargin,
  setMinContracts,
  setMaxContractsInput,
  setTargetVolatilityPct,
  setInverseMinContracts,
  setInverseMaxContractsInput,
  errors = {},
}: PositionSizingModeFieldsProps) {
  if (mode === 'fixed_quantity') {
    return (
      <div className="bg-carbon-900/50 border-carbon-600/40 space-y-1 rounded-lg border p-3">
        <label htmlFor="position-quantity" className="text-silver-400 text-xs">
          Quantity
        </label>
        <input
          id="position-quantity"
          type="number"
          step="1"
          min="0.01"
          value={fields.quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className={inputClass}
        />
        {errors.quantity && <p className={fieldErrorClass}>{errors.quantity}</p>}
      </div>
    )
  }

  if (mode === 'fixed_safety_margin') {
    return (
      <div className="bg-carbon-900/50 border-carbon-600/40 space-y-3 rounded-lg border p-3">
        <div className="space-y-1">
          <label className="text-silver-400 text-xs">Safety Margin per Contract</label>
          <input
            type="number"
            step="1"
            min="1"
            value={fields.safetyMargin}
            onChange={(e) => setSafetyMargin(Number(e.target.value))}
            className={inputClass}
          />
          {errors.safety_margin_per_contract && (
            <p className={fieldErrorClass}>{errors.safety_margin_per_contract}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-silver-400 text-xs">Min Contracts</label>
          <input
            type="number"
            step="1"
            min="0"
            value={fields.minContracts}
            onChange={(e) => setMinContracts(Number(e.target.value))}
            className={inputClass}
          />
          {errors.min_contracts && <p className={fieldErrorClass}>{errors.min_contracts}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-silver-400 text-xs">Max Contracts (optional)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={fields.maxContractsInput}
            onChange={(e) => setMaxContractsInput(e.target.value)}
            className={inputClass}
            placeholder="No limit"
          />
          {errors.max_contracts && <p className={fieldErrorClass}>{errors.max_contracts}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-carbon-900/50 border-carbon-600/40 space-y-3 rounded-lg border p-3">
      <p className="text-silver-400 text-xs">
        Requires a strategy that exposes a volatility indicator on each bar (e.g. TSMOM). Other
        strategies may produce zero trades.
      </p>
      <div className="space-y-1">
        <label htmlFor="target-volatility-pct" className="text-silver-400 text-xs">
          Target volatility (%)
        </label>
        <input
          id="target-volatility-pct"
          type="number"
          step="0.1"
          min="0.01"
          value={fields.targetVolatilityPct}
          onChange={(e) => setTargetVolatilityPct(Number(e.target.value))}
          className={inputClass}
        />
        {errors.target_volatility_pct && (
          <p className={fieldErrorClass}>{errors.target_volatility_pct}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-silver-400 text-xs">Min Contracts</label>
        <input
          type="number"
          step="1"
          min="0"
          value={fields.inverseMinContracts}
          onChange={(e) => setInverseMinContracts(Number(e.target.value))}
          className={inputClass}
        />
        {errors.min_contracts && <p className={fieldErrorClass}>{errors.min_contracts}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-silver-400 text-xs">Max Contracts (optional)</label>
        <input
          type="number"
          step="1"
          min="1"
          value={fields.inverseMaxContractsInput}
          onChange={(e) => setInverseMaxContractsInput(e.target.value)}
          className={inputClass}
          placeholder="No limit"
        />
        {errors.max_contracts && <p className={fieldErrorClass}>{errors.max_contracts}</p>}
      </div>
    </div>
  )
}
