import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { LabeledField } from '@/components/ui/LabeledField'
import { Panel } from '@/components/ui/Panel'
import { RangeInput } from '@/components/ui/RangeInput'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { fieldErrorClass, inputClass } from '@/components/shared/InstrumentConfigFields'
import { NumberInput } from '@/components/ui/number-input'
import { cn } from '@/lib/utils'
import type { ObjectiveMode, Sampler } from '@/types/optimization'

export { fieldErrorClass, inputClass }

export const OBJECTIVE_MODES: { value: ObjectiveMode; label: string }[] = [
  { value: 'maximize_net_profit', label: 'Maximize Net Profit' },
  { value: 'maximize_sharpe', label: 'Maximize Sharpe' },
  { value: 'minimize_drawdown', label: 'Minimize Drawdown' },
  { value: 'maximize_return_drawdown', label: 'Maximize Return / Drawdown' },
  { value: 'multi_objective_return_drawdown', label: 'Multi-objective: Return vs Drawdown' },
]

export const SAMPLERS: { value: Sampler; label: string }[] = [
  { value: 'tpe', label: 'TPE' },
  { value: 'random', label: 'Random' },
  { value: 'nsgaii', label: 'NSGA-II (multi-objective)' },
]

export const PRUNERS = [
  { value: 'none', label: 'None' },
  { value: 'median', label: 'Median' },
  { value: 'hyperband', label: 'Hyperband' },
] as const

export type RiskMode = 'fixed_quantity' | 'fixed_safety_margin' | 'inverse_volatility'

export const labelClass = 'text-silver-400 text-xs'
export const sectionTitleClass = 'text-silver-200 text-sm font-medium'
export const panelClass = 'surface-panel space-y-3 rounded-lg p-3'

export function RangeRow({
  label,
  low,
  high,
  setLow,
  setHigh,
  step = 'any',
  stepValue,
  setStepValue,
}: {
  label: ReactNode
  low: number
  high: number
  setLow: (v: number) => void
  setHigh: (v: number) => void
  step?: string
  stepValue?: number | null
  setStepValue?: (v: number | null) => void
}) {
  const editableStep = typeof setStepValue === 'function'
  const intOnly = step === '1'

  if (editableStep) {
    return (
      <LabeledField label={typeof label === 'string' ? label : 'Range'}>
        {typeof label !== 'string' ? <div className="mb-1">{label}</div> : null}
        <RangeInput
          min={low}
          max={high}
          step={stepValue ?? null}
          intOnly={intOnly}
          onChange={({ min, max, step: nextStep }) => {
            setLow(min)
            setHigh(max)
            setStepValue(nextStep)
          }}
        />
      </LabeledField>
    )
  }

  const rangeInvalid = low > high

  return (
    <LabeledField
      label={typeof label === 'string' ? label : 'Range'}
      error={rangeInvalid ? 'Low must be ≤ high.' : undefined}
    >
      {typeof label !== 'string' ? <div className="mb-1">{label}</div> : null}
      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          step={step}
          value={low}
          onChange={setLow}
          className={inputClass}
          placeholder="Low"
          aria-label={`${typeof label === 'string' ? label : 'Range'} low`}
        />
        <NumberInput
          step={step}
          value={high}
          onChange={setHigh}
          className={inputClass}
          placeholder="High"
          aria-label={`${typeof label === 'string' ? label : 'Range'} high`}
        />
      </div>
    </LabeledField>
  )
}

type FormSectionProps = {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function FormSection({ title, open, onToggle, children }: FormSectionProps) {
  return (
    <Panel living className="overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        className="hover:bg-carbon-800/30 flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors"
      >
        <SectionHeader title={title} />
        <ChevronDown
          className={cn(
            'text-silver-400 h-4 w-4 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div className="border-carbon-600/40 space-y-3 border-t px-3 py-3">{children}</div>
      ) : null}
    </Panel>
  )
}
