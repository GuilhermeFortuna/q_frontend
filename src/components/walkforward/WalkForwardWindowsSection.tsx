import { FormSection, inputClass } from '@/components/optimize/optimizeFormShared'
import { estimateWalkForwardWindowCount } from '@/lib/walkforward/windowCount'
import type { WalkForwardMode } from '@/types/walkforward'

type WalkForwardWindowsSectionProps = {
  open: boolean
  onToggle: () => void
  trainDays: number
  setTrainDays: (value: number) => void
  testDays: number
  setTestDays: (value: number) => void
  mode: WalkForwardMode
  setMode: (value: WalkForwardMode) => void
  minWindows: number
  setMinWindows: (value: number) => void
  startDate: Date
  endDate: Date
}

export function WalkForwardWindowsSection({
  open,
  onToggle,
  trainDays,
  setTrainDays,
  testDays,
  setTestDays,
  mode,
  setMode,
  minWindows,
  setMinWindows,
  startDate,
  endDate,
}: WalkForwardWindowsSectionProps) {
  const impliedWindows = estimateWalkForwardWindowCount(startDate, endDate, trainDays, testDays)
  const belowMinimum = impliedWindows > 0 && impliedWindows < minWindows

  return (
    <FormSection title="Walk-forward windows" open={open} onToggle={onToggle}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="wf-train-days" className="text-silver-200 text-sm font-medium">
            Train days
          </label>
          <input
            id="wf-train-days"
            type="number"
            min={1}
            value={trainDays}
            onChange={(e) => setTrainDays(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="wf-test-days" className="text-silver-200 text-sm font-medium">
            Test days
          </label>
          <input
            id="wf-test-days"
            type="number"
            min={1}
            value={testDays}
            onChange={(e) => setTestDays(Number(e.target.value))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="wf-mode" className="text-silver-200 text-sm font-medium">
          Mode
        </label>
        <select
          id="wf-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as WalkForwardMode)}
          className={inputClass}
        >
          <option value="rolling">Rolling — fixed train window slides forward</option>
          <option value="anchored">Anchored — train always starts at history start</option>
        </select>
        <p className="text-silver-400 text-xs">
          {mode === 'rolling'
            ? 'Each window uses a fixed-length in-sample period ending right before the OOS test.'
            : 'Each window retrains from the start of history up to the next OOS test.'}
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="wf-min-windows" className="text-silver-200 text-sm font-medium">
          Minimum windows
        </label>
        <input
          id="wf-min-windows"
          type="number"
          min={1}
          value={minWindows}
          onChange={(e) => setMinWindows(Number(e.target.value))}
          className={inputClass}
        />
      </div>

      <div
        className={
          belowMinimum
            ? 'rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200'
            : 'border-carbon-600/40 bg-carbon-900/40 text-silver-300 rounded-md border p-3 text-xs'
        }
      >
        <p>
          Implied windows for this range:{' '}
          <span className="text-brass-400 font-mono font-semibold">{impliedWindows}</span>
        </p>
        {belowMinimum ? (
          <p className="mt-1 text-amber-200/90">
            Fewer windows than minimum ({minWindows}). Extend the date range or shrink train/test
            days before launching.
          </p>
        ) : null}
      </div>
    </FormSection>
  )
}
