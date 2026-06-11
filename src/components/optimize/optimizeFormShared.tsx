import { ChevronDown } from 'lucide-react'

import { fieldErrorClass, inputClass } from '@/components/shared/InstrumentConfigFields'
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

export type RiskMode = 'fixed_quantity' | 'fixed_safety_margin'

export const labelClass = 'text-silver-400 text-xs'
export const sectionTitleClass = 'text-silver-200 text-sm font-medium'
export const panelClass = 'bg-carbon-900/50 border-carbon-600/40 space-y-3 rounded-lg border p-3'

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
  label: string
  low: number
  high: number
  setLow: (v: number) => void
  setHigh: (v: number) => void
  step?: string
  /** Current sampling step. `null` means a continuous float range. */
  stepValue?: number | null
  /** When provided, an editable "Step" input is rendered alongside low/high. */
  setStepValue?: (v: number | null) => void
}) {
  const editableStep = typeof setStepValue === 'function'
  const rangeInvalid = low > high
  const stepInvalid = stepValue != null && stepValue <= 0
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      <div className={cn('grid gap-2', editableStep ? 'grid-cols-3' : 'grid-cols-2')}>
        <input
          type="number"
          step={step}
          value={low}
          onChange={(e) => setLow(Number(e.target.value))}
          className={inputClass}
          placeholder="Low"
          aria-label={`${label} low`}
        />
        <input
          type="number"
          step={step}
          value={high}
          onChange={(e) => setHigh(Number(e.target.value))}
          className={inputClass}
          placeholder="High"
          aria-label={`${label} high`}
        />
        {editableStep && (
          <input
            type="number"
            min="0"
            step={step}
            value={stepValue ?? ''}
            onChange={(e) => {
              const next = e.target.value.trim()
              setStepValue(next === '' ? null : Number(next))
            }}
            className={inputClass}
            placeholder="Step"
            aria-label={`${label} step`}
          />
        )}
      </div>
      {rangeInvalid && <p className={fieldErrorClass}>Low must be ≤ high.</p>}
      {stepInvalid && <p className={fieldErrorClass}>Step must be greater than 0.</p>}
    </div>
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
    <div className="border-carbon-600/40 overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        className="hover:bg-carbon-800/30 flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors"
      >
        <span className={sectionTitleClass}>{title}</span>
        <ChevronDown
          className={cn(
            'text-silver-400 h-4 w-4 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="border-carbon-600/40 space-y-3 border-t px-3 py-3">{children}</div>}
    </div>
  )
}
