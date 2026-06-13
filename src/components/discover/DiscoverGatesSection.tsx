import { FormSection, inputClass } from '@/components/optimize/optimizeFormShared'
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
        <div className="space-y-1">
          <label htmlFor="gate-min-windows" className="text-silver-300 text-xs font-semibold">
            Min completed windows
          </label>
          <input
            id="gate-min-windows"
            type="number"
            min={1}
            value={gates.min_completed_windows}
            onChange={(e) => setGates({ ...gates, min_completed_windows: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="gate-min-trades" className="text-silver-300 text-xs font-semibold">
            Min OOS trades
          </label>
          <input
            id="gate-min-trades"
            type="number"
            min={0}
            value={gates.min_oos_trades}
            onChange={(e) => setGates({ ...gates, min_oos_trades: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="gate-eff-low" className="text-silver-300 text-xs font-semibold">
            Efficiency low
          </label>
          <input
            id="gate-eff-low"
            type="number"
            step={0.05}
            min={0}
            value={gates.efficiency_low}
            onChange={(e) => setGates({ ...gates, efficiency_low: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="gate-eff-high" className="text-silver-300 text-xs font-semibold">
            Efficiency high
          </label>
          <input
            id="gate-eff-high"
            type="number"
            step={0.05}
            min={0}
            value={gates.efficiency_high}
            onChange={(e) => setGates({ ...gates, efficiency_high: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
      </div>
    </FormSection>
  )
}
