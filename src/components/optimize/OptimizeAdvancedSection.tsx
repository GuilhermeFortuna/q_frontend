import { FormSection, inputClass, PRUNERS } from '@/components/optimize/optimizeFormShared'

type OptimizeAdvancedSectionProps = {
  open: boolean
  onToggle: () => void
  seed: number
  setSeed: (v: number) => void
  pruner: 'none' | 'median' | 'hyperband'
  setPruner: (v: 'none' | 'median' | 'hyperband') => void
  continueOnTrialError: boolean
  setContinueOnTrialError: (v: boolean) => void
}

export function OptimizeAdvancedSection({
  open,
  onToggle,
  seed,
  setSeed,
  pruner,
  setPruner,
  continueOnTrialError,
  setContinueOnTrialError,
}: OptimizeAdvancedSectionProps) {
  return (
    <FormSection title="Advanced Settings" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-silver-300 text-xs font-semibold">Seed</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className="text-silver-300 text-xs font-semibold">Pruner</label>
            <select
              value={pruner}
              onChange={(e) => setPruner(e.target.value as 'none' | 'median' | 'hyperband')}
              className={inputClass}
            >
              {PRUNERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-1">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={continueOnTrialError}
              onChange={(e) => setContinueOnTrialError(e.target.checked)}
              className="accent-brass-500 border-carbon-600 bg-carbon-900 text-brass-500 h-4 w-4 rounded"
            />
            <span className="text-silver-200 text-sm font-semibold">Continue on Trial Error</span>
          </label>
        </div>

        <div className="border-carbon-600/30 bg-carbon-950/20 space-y-1 rounded-lg border border-dashed p-3 opacity-60">
          <p className="text-silver-300 text-xs font-bold tracking-wider uppercase">Coming soon</p>
          <p className="text-silver-400 text-xs leading-normal">
            Storage backend, parallel execution, and custom constraints.
          </p>
        </div>
      </div>
    </FormSection>
  )
}
