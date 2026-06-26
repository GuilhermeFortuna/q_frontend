import { FormSection, inputClass } from '@/components/optimize/optimizeFormShared'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import type { GateConfig } from '@/types/strategySearch'

type DiscoverGatesSectionProps = {
  open: boolean
  onToggle: () => void
  gates: GateConfig
  setGates: (value: GateConfig) => void
}

export function DiscoverGatesSection({
  open,
  onToggle,
  gates,
  setGates,
}: DiscoverGatesSectionProps) {
  return (
    <FormSection title="Gates" open={open} onToggle={onToggle}>
      <p className="text-silver-400 mb-3 text-xs leading-normal">
        Candidates must pass these thresholds to receive an OOS rank. Flagged strategies stay on the
        leaderboard but sort below passing candidates.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="Min completed windows" htmlFor="gate-min-windows">
          <NumberInput
            id="gate-min-windows"
            min={1}
            integer
            value={gates.min_completed_windows}
            onChange={(value) => setGates({ ...gates, min_completed_windows: value })}
            className={inputClass}
          />
        </LabeledField>
        <LabeledField label="Min OOS trades" htmlFor="gate-min-trades">
          <NumberInput
            id="gate-min-trades"
            min={0}
            integer
            value={gates.min_oos_trades}
            onChange={(value) => setGates({ ...gates, min_oos_trades: value })}
            className={inputClass}
          />
        </LabeledField>
        <LabeledField label="Efficiency low" htmlFor="gate-eff-low">
          <NumberInput
            id="gate-eff-low"
            step={0.05}
            min={0}
            value={gates.efficiency_low}
            onChange={(value) => setGates({ ...gates, efficiency_low: value })}
            className={inputClass}
          />
        </LabeledField>
        <LabeledField label="Efficiency high" htmlFor="gate-eff-high">
          <NumberInput
            id="gate-eff-high"
            step={0.05}
            min={0}
            value={gates.efficiency_high}
            onChange={(value) => setGates({ ...gates, efficiency_high: value })}
            className={inputClass}
          />
        </LabeledField>
      </div>
    </FormSection>
  )
}
