import type { ReactNode } from 'react'

import { NumberInput } from '@/components/ui/number-input'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import { cn } from '@/lib/utils'

export type RangeInputValues = {
  min: number
  max: number
  step: number | null
}

export type RangeInputProps = {
  min: number
  max: number
  step: number | null
  onChange: (values: RangeInputValues) => void
  error?: string
  intOnly?: boolean
  className?: string
  labels?: {
    min?: string
    max?: string
    step?: string
  }
}

type RangeFieldProps = {
  caption: string
  children: ReactNode
}

function RangeField({ caption, children }: Omit<RangeFieldProps, 'ariaLabel'>) {
  return (
    <div className="space-y-1">
      <span className="accent-wayfinding text-[10px] font-bold tracking-wider uppercase">
        {caption}
      </span>
      {children}
    </div>
  )
}

export function RangeInput({
  min,
  max,
  step,
  onChange,
  error,
  intOnly = false,
  className,
  labels,
}: RangeInputProps) {
  const stepAttr = intOnly ? '1' : 'any'
  const rangeInvalid = min > max
  const stepInvalid = step != null && step <= 0

  const minLabel = labels?.min ?? 'Min'
  const maxLabel = labels?.max ?? 'Max'
  const stepLabel = labels?.step ?? 'Step'

  return (
    <div className={cn('space-y-1', className)}>
      <div className="grid grid-cols-3 gap-2">
        <RangeField caption={minLabel}>
          <NumberInput
            step={stepAttr}
            value={min}
            integer={intOnly}
            showSteppers
            onChange={(nextMin) => onChange({ min: nextMin, max, step })}
            className={wellInputClass}
            aria-label={labels?.min ?? 'Minimum'}
          />
        </RangeField>
        <RangeField caption={maxLabel}>
          <NumberInput
            step={stepAttr}
            value={max}
            integer={intOnly}
            showSteppers
            onChange={(nextMax) => onChange({ min, max: nextMax, step })}
            className={wellInputClass}
            aria-label={labels?.max ?? 'Maximum'}
          />
        </RangeField>
        <RangeField caption={stepLabel}>
          <NumberInput
            min="0"
            step={stepAttr}
            nullable
            integer={intOnly}
            showSteppers
            value={step}
            onChange={(nextStep) => onChange({ min, max, step: nextStep })}
            className={wellInputClass}
            aria-label={labels?.step ?? 'Step'}
          />
        </RangeField>
      </div>
      {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      {!error && rangeInvalid ? (
        <p className="text-xs font-medium text-rose-400">Min must be ≤ max.</p>
      ) : null}
      {!error && stepInvalid ? (
        <p className="text-xs font-medium text-rose-400">Step must be greater than 0.</p>
      ) : null}
    </div>
  )
}
