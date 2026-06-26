import { FormSection, inputClass } from '@/components/optimize/optimizeFormShared'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { estimateWalkForwardWindowCount } from '@/lib/walkforward/windowCount'
import { cn } from '@/lib/utils'
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
    <FormSection title="Walk-forward Windows" open={open} onToggle={onToggle}>
      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="Train Days" htmlFor="wf-train-days">
          <NumberInput
            id="wf-train-days"
            min={1}
            integer
            value={trainDays}
            onChange={setTrainDays}
            className={inputClass}
          />
        </LabeledField>
        <LabeledField label="Test Days" htmlFor="wf-test-days">
          <NumberInput
            id="wf-test-days"
            min={1}
            integer
            value={testDays}
            onChange={setTestDays}
            className={inputClass}
          />
        </LabeledField>
      </div>

      <LabeledField
        label="Mode"
        hint={
          mode === 'rolling'
            ? 'Each window uses a fixed-length in-sample period ending right before the OOS test.'
            : 'Each window retrains from the start of history up to the next OOS test.'
        }
      >
        <SegmentedToggle
          aria-label="Walk-forward mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'rolling', label: 'Rolling' },
            { value: 'anchored', label: 'Anchored' },
          ]}
        />
      </LabeledField>

      <LabeledField label="Minimum Windows" htmlFor="wf-min-windows">
        <NumberInput
          id="wf-min-windows"
          min={1}
          integer
          value={minWindows}
          onChange={setMinWindows}
          className={inputClass}
        />
      </LabeledField>

      <Panel
        className={cn(
          'p-3 text-xs',
          belowMinimum ? 'border-amber-500/20 bg-amber-500/10 text-amber-200' : 'text-silver-300',
        )}
      >
        <p className="font-medium">
          Implied windows for this range:{' '}
          <span className="text-brass-400 font-mono font-bold">{impliedWindows}</span>
        </p>
        {belowMinimum ? (
          <p className="mt-1 leading-normal text-amber-200/90">
            Fewer windows than minimum ({minWindows}). Extend the date range or shrink train/test
            days before launching.
          </p>
        ) : null}
      </Panel>
    </FormSection>
  )
}
