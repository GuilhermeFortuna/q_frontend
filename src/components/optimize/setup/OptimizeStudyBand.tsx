import {
  inputClass,
  OBJECTIVE_MODES,
  PRUNERS,
  SAMPLERS,
} from '@/components/optimize/optimizeFormShared'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel, PanelHeader } from '@/components/ui/Panel'
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

export function OptimizeStudyBand({ fields, setters, validation }: OptimizeStudyBandProps) {
  const { isMultiObjective } = validation

  return (
    <Panel className="shrink-0 space-y-3 p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ConfigSection title="Optimization Study">
          <div className="space-y-3">
            <LabeledField label="Objective" htmlFor="optimize-objective">
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
            </LabeledField>

            <div className="grid grid-cols-2 gap-3">
              <LabeledField
                label="Sampler"
                htmlFor="optimize-sampler"
                hint={isMultiObjective ? 'NSGA-II is used for multi-objective studies.' : undefined}
              >
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
              </LabeledField>

              <LabeledField label="Trials" htmlFor="optimize-trials">
                <NumberInput
                  id="optimize-trials"
                  min="1"
                  integer
                  value={fields.nTrials}
                  onChange={setters.setNTrials}
                  className={inputClass}
                />
              </LabeledField>
            </div>
          </div>
        </ConfigSection>

        <ConfigSection title="Advanced Settings">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <LabeledField label="Seed" htmlFor="optimize-seed">
                <NumberInput
                  id="optimize-seed"
                  value={fields.seed}
                  onChange={setters.setSeed}
                  className={inputClass}
                />
              </LabeledField>

              <LabeledField label="Pruner" htmlFor="optimize-pruner">
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
              </LabeledField>

              <LabeledField
                label="Worker processes"
                htmlFor="optimize-max-workers"
                hint="Candle studies only. Empty uses all CPU cores."
              >
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
              </LabeledField>
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
        </ConfigSection>
      </div>
    </Panel>
  )
}
