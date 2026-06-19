import {
  FormSection,
  inputClass,
  OBJECTIVE_MODES,
  SAMPLERS,
} from '@/components/optimize/optimizeFormShared'
import { NumberInput } from '@/components/ui/number-input'
import type { ObjectiveMode, Sampler } from '@/types/optimization'

type OptimizeStudySectionProps = {
  open: boolean
  onToggle: () => void
  objective: ObjectiveMode
  setObjective: (v: ObjectiveMode) => void
  sampler: Sampler
  setSampler: (v: Sampler) => void
  nTrials: number
  setNTrials: (v: number) => void
  isMultiObjective: boolean
}

export function OptimizeStudySection({
  open,
  onToggle,
  objective,
  setObjective,
  sampler,
  setSampler,
  nTrials,
  setNTrials,
  isMultiObjective,
}: OptimizeStudySectionProps) {
  return (
    <FormSection title="Optimization Study" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-silver-300 text-xs font-semibold">Objective</label>
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value as ObjectiveMode)}
            className={inputClass}
          >
            {OBJECTIVE_MODES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-silver-300 text-xs font-semibold">Sampler</label>
            <select
              value={isMultiObjective ? 'nsgaii' : sampler}
              onChange={(e) => setSampler(e.target.value as Sampler)}
              disabled={isMultiObjective}
              className={`${inputClass} disabled:opacity-60`}
            >
              {SAMPLERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {isMultiObjective && (
              <p className="text-silver-500 mt-0.5 text-[10px] leading-normal">
                NSGA-II is used for multi-objective studies.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-silver-300 text-xs font-semibold">Trials</label>
            <NumberInput
              min="1"
              integer
              value={nTrials}
              onChange={setNTrials}
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </FormSection>
  )
}
