import {
  inputClass,
  OBJECTIVE_MODES,
  PRUNERS,
  SAMPLERS,
} from '@/components/optimize/optimizeFormShared'
import { NumberInput } from '@/components/ui/number-input'
import { normalizeLeadingZero } from '@/lib/numberInput'
import type {
  OptimizeConfigFields,
  OptimizeConfigSetters,
  OptimizeConfigValidation,
} from '@/lib/optimize/useOptimizeConfig'
import { cn } from '@/lib/utils'

type OptimizeStudyBandProps = {
  fields: OptimizeConfigFields
  setters: OptimizeConfigSetters
  validation: OptimizeConfigValidation
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
        'border-carbon-600/40 bg-carbon-950/20 flex flex-col gap-3 rounded-lg border px-3.5 py-3',
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

export function OptimizeStudyBand({ fields, setters, validation }: OptimizeStudyBandProps) {
  const { isMultiObjective } = validation

  return (
    <div className="border-carbon-600/50 bg-carbon-900/20 shrink-0 space-y-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Fieldset legend="Optimization Study">
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="optimize-objective" className="text-silver-300 text-xs font-medium">
                Objective
              </label>
              <select
                id="optimize-objective"
                value={fields.objective}
                onChange={(e) =>
                  setters.setObjective(e.target.value as OptimizeConfigFields['objective'])
                }
                className={inputClass}
              >
                {OBJECTIVE_MODES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="optimize-sampler" className="text-silver-300 text-xs font-medium">
                  Sampler
                </label>
                <select
                  id="optimize-sampler"
                  value={isMultiObjective ? 'nsgaii' : fields.sampler}
                  onChange={(e) =>
                    setters.setSampler(e.target.value as OptimizeConfigFields['sampler'])
                  }
                  disabled={isMultiObjective}
                  className={`${inputClass} disabled:opacity-60`}
                >
                  {SAMPLERS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                {isMultiObjective ? (
                  <p className="text-silver-500 mt-0.5 text-[10px] leading-normal">
                    NSGA-II is used for multi-objective studies.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label htmlFor="optimize-trials" className="text-silver-300 text-xs font-medium">
                  Trials
                </label>
                <NumberInput
                  id="optimize-trials"
                  min="1"
                  integer
                  value={fields.nTrials}
                  onChange={setters.setNTrials}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </Fieldset>

        <Fieldset legend="Advanced Settings">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="optimize-seed" className="text-silver-300 text-xs font-medium">
                  Seed
                </label>
                <NumberInput
                  id="optimize-seed"
                  value={fields.seed}
                  onChange={setters.setSeed}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="optimize-pruner" className="text-silver-300 text-xs font-medium">
                  Pruner
                </label>
                <select
                  id="optimize-pruner"
                  value={fields.pruner}
                  onChange={(e) =>
                    setters.setPruner(e.target.value as OptimizeConfigFields['pruner'])
                  }
                  className={inputClass}
                >
                  {PRUNERS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="optimize-max-workers"
                  className="text-silver-300 text-xs font-medium"
                >
                  Worker processes
                </label>
                <input
                  id="optimize-max-workers"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Auto"
                  value={fields.maxWorkersInput}
                  onChange={(e) =>
                    setters.setMaxWorkersInput(
                      normalizeLeadingZero(fields.maxWorkersInput, e.target.value),
                    )
                  }
                  className={inputClass}
                />
                <p className="text-silver-400 text-[10px] leading-normal">
                  Candle studies only. Empty uses all CPU cores.
                </p>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={fields.continueOnTrialError}
                onChange={(e) => setters.setContinueOnTrialError(e.target.checked)}
                className="accent-brass-500 border-carbon-600 bg-carbon-900 text-brass-500 h-4 w-4 rounded"
              />
              <span className="text-silver-200 text-sm font-medium">Continue on Trial Error</span>
            </label>
          </div>
        </Fieldset>
      </div>
    </div>
  )
}
