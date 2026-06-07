import {
  FormSection,
  inputClass,
  labelClass,
  PRUNERS,
  sectionTitleClass,
} from '@/components/optimize/optimizeFormShared'

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
    <FormSection title="Advanced" open={open} onToggle={onToggle}>
      <div className="space-y-2">
        <label className={sectionTitleClass}>Seed</label>
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value))}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label className={sectionTitleClass}>Pruner</label>
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

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={continueOnTrialError}
          onChange={(e) => setContinueOnTrialError(e.target.checked)}
          className="accent-brass-500"
        />
        <span className={labelClass}>Continue on trial error</span>
      </label>

      <div className="border-carbon-600/40 space-y-2 rounded-lg border border-dashed p-3 opacity-60">
        <p className={sectionTitleClass}>Coming soon</p>
        <p className={labelClass}>Storage backend, parallel execution, and custom constraints.</p>
      </div>
    </FormSection>
  )
}
