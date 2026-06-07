import {
  FormSection,
  inputClass,
  labelClass,
  OBJECTIVE_MODES,
  SAMPLERS,
  sectionTitleClass,
} from '@/components/optimize/optimizeFormShared'
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
    <FormSection title="Optimization" open={open} onToggle={onToggle}>
      <div className="space-y-2">
        <label className={sectionTitleClass}>Objective</label>
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

      <div className="space-y-2">
        <label className={sectionTitleClass}>Sampler</label>
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
          <p className={labelClass}>NSGA-II is used for multi-objective studies.</p>
        )}
      </div>

      <div className="space-y-2">
        <label className={sectionTitleClass}>Trials</label>
        <input
          type="number"
          min="1"
          value={nTrials}
          onChange={(e) => setNTrials(Number(e.target.value))}
          className={inputClass}
        />
      </div>
    </FormSection>
  )
}
