import { FormSection, inputClass, PRUNERS } from '@/components/optimize/optimizeFormShared'
import { NumberInput } from '@/components/ui/number-input'
import { normalizeLeadingZero } from '@/lib/numberInput'

type OptimizeAdvancedSectionProps = {
  open: boolean
  onToggle: () => void
  seed: number
  setSeed: (v: number) => void
  pruner: 'none' | 'median' | 'hyperband'
  setPruner: (v: 'none' | 'median' | 'hyperband') => void
  continueOnTrialError: boolean
  setContinueOnTrialError: (v: boolean) => void
  maxWorkersInput?: string
  onMaxWorkersInputChange?: (v: string) => void
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
  maxWorkersInput,
  onMaxWorkersInputChange,
}: OptimizeAdvancedSectionProps) {
  const showWorkerProcesses = maxWorkersInput != null && onMaxWorkersInputChange != null

  return (
    <FormSection title="Advanced Settings" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        <div className={`grid gap-3 ${showWorkerProcesses ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className="space-y-1">
            <label className="text-silver-300 text-xs font-semibold">Seed</label>
            <NumberInput value={seed} onChange={setSeed} className={inputClass} />
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

          {showWorkerProcesses ? (
            <div className="space-y-1">
              <label
                htmlFor="optimize-max-workers"
                className="text-silver-300 text-xs font-semibold"
              >
                Worker processes
              </label>
              <input
                id="optimize-max-workers"
                type="number"
                min={1}
                step={1}
                placeholder="Auto"
                value={maxWorkersInput}
                onChange={(e) =>
                  onMaxWorkersInputChange(normalizeLeadingZero(maxWorkersInput, e.target.value))
                }
                className={inputClass}
              />
              <p className="text-silver-400 text-[11px] leading-normal">
                Candle studies only. Empty uses all CPU cores.
              </p>
            </div>
          ) : null}
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

        {!showWorkerProcesses ? (
          <div className="border-carbon-600/30 bg-carbon-950/20 space-y-1 rounded-lg border border-dashed p-3 opacity-60">
            <p className="text-silver-300 text-xs font-bold tracking-wider uppercase">
              Coming soon
            </p>
            <p className="text-silver-400 text-xs leading-normal">
              Storage backend and custom constraints.
            </p>
          </div>
        ) : null}
      </div>
    </FormSection>
  )
}
