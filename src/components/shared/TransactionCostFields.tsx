import { fieldErrorClass, inputClass } from '@/components/shared/InstrumentConfigFields'

type TransactionCostFieldsProps = {
  costPerContract: number
  setCostPerContract: (value: number) => void
  costBps: number
  setCostBps: (value: number) => void
  errors?: Partial<Record<'costPerContract' | 'costBps', string>>
}

export function TransactionCostFields({
  costPerContract,
  setCostPerContract,
  costBps,
  setCostBps,
  errors = {},
}: TransactionCostFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-silver-200 text-sm font-medium">Transaction costs</h3>
        <p className="text-silver-400 mt-1 text-xs">
          Applied per side (entry and exit each pay once). Leave at 0 for gross-of-costs runs.
        </p>
      </div>
      <div className="bg-carbon-900/50 border-carbon-600/40 space-y-3 rounded-lg border p-3">
        <div className="space-y-1">
          <label htmlFor="cost-per-contract" className="text-silver-400 text-xs">
            Cost per contract (per side)
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
          {errors.costPerContract && <p className={fieldErrorClass}>{errors.costPerContract}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="cost-bps" className="text-silver-400 text-xs">
            Cost (bps of notional, per side)
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
          {errors.costBps && <p className={fieldErrorClass}>{errors.costBps}</p>}
        </div>
      </div>
    </div>
  )
}
