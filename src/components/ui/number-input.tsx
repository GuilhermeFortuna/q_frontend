import {
  forwardRef,
  useEffect,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type MouseEvent,
} from 'react'

import { normalizeLeadingZero, parseNumberInput } from '@/lib/numberInput'
import { cn } from '@/lib/utils'

type NumberInputBaseProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  integer?: boolean
  /** When blur leaves the field empty, commit this value instead of reverting. */
  emptyOnBlur?: number
  /** Custom ▲▼ steppers (hides native browser spinners). */
  showSteppers?: boolean
}

type RequiredNumberInputProps = NumberInputBaseProps & {
  value: number
  onChange: (value: number) => void
  nullable?: false
}

type NullableNumberInputProps = NumberInputBaseProps & {
  value: number | null
  onChange: (value: number | null) => void
  nullable: true
}

export type NumberInputProps = RequiredNumberInputProps | NullableNumberInputProps

function resolveStepperDelta(
  step: InputHTMLAttributes<HTMLInputElement>['step'],
  integer: boolean,
) {
  if (step === 'any' || step === undefined) {
    return integer ? 1 : 0.01
  }
  const parsed = typeof step === 'number' ? step : Number.parseFloat(String(step))
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return integer ? 1 : 0.01
}

function resolveMinValue(min: InputHTMLAttributes<HTMLInputElement>['min']) {
  if (min === undefined || min === '') {
    return Number.NEGATIVE_INFINITY
  }
  const parsed = Number.parseFloat(String(min))
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    onChange,
    integer = false,
    nullable = false,
    emptyOnBlur,
    showSteppers = false,
    className,
    onBlur,
    onFocus,
    step,
    min,
    ...props
  },
  ref,
) {
  const [draft, setDraft] = useState(() => (value == null ? '' : String(value)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setDraft(value == null ? '' : String(value))
    }
  }, [value, focused])

  const commitDraft = (raw: string) => {
    const parsed = parseNumberInput(raw, integer)
    if (parsed !== null) {
      if (nullable) {
        ;(onChange as (next: number | null) => void)(parsed)
      } else {
        ;(onChange as (next: number) => void)(parsed)
      }
      return parsed
    }

    if (nullable && raw.trim() === '') {
      ;(onChange as (next: number | null) => void)(null)
      return null
    }

    return null
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = normalizeLeadingZero(draft, event.target.value)
    setDraft(next)
    commitDraft(next)
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(false)

    const parsed = commitDraft(draft)
    if (parsed !== null) {
      setDraft(String(parsed))
    } else if (emptyOnBlur !== undefined) {
      ;(onChange as (next: number) => void)(emptyOnBlur)
      setDraft(String(emptyOnBlur))
    } else if (nullable) {
      setDraft('')
    } else {
      setDraft(value == null ? '' : String(value))
    }

    onBlur?.(event)
  }

  const stepBy = (direction: 1 | -1) => {
    const delta = resolveStepperDelta(step, integer) * direction
    const minValue = resolveMinValue(min)
    const current =
      value ??
      (draft.trim() === ''
        ? Number.isFinite(minValue)
          ? minValue
          : 0
        : parseNumberInput(draft, integer))
    if (current === null) {
      if (nullable) {
        const next = Math.max(minValue, integer ? 1 : 0.01)
        ;(onChange as (next: number | null) => void)(next)
        setDraft(String(next))
      }
      return
    }

    let next = current + delta
    if (integer) {
      next = Math.round(next)
    }
    next = Math.max(minValue, next)
    if (nullable && direction < 0 && next <= minValue && draft.trim() === '' && value === null) {
      ;(onChange as (next: number | null) => void)(null)
      setDraft('')
      return
    }

    if (nullable) {
      ;(onChange as (next: number | null) => void)(next)
    } else {
      ;(onChange as (next: number) => void)(next)
    }
    setDraft(String(next))
  }

  const stopStepperPropagation = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const input = (
    <input
      ref={ref}
      type="number"
      {...props}
      step={step}
      min={min}
      className={cn(showSteppers && 'number-input--steppers appearance-textfield pr-8', className)}
      value={draft}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  )

  if (!showSteppers) {
    return input
  }

  return (
    <div className="relative">
      {input}
      <div className="border-carbon-600/50 absolute top-1/2 right-1 flex -translate-y-1/2 flex-col overflow-hidden rounded border">
        <button
          type="button"
          tabIndex={-1}
          className="text-silver-400 hover:text-gold-400 flex h-3.5 w-5 items-center justify-center text-[9px] leading-none transition-[transform,color] duration-[var(--motion-fast)] ease-[var(--ease-exit)] hover:duration-[var(--motion-base)] hover:ease-[var(--ease-out)] active:translate-y-[0.5px] active:scale-[0.985] active:duration-[var(--motion-fast)] active:ease-[var(--ease-out)]"
          onMouseDown={stopStepperPropagation}
          onClick={() => stepBy(1)}
          aria-label="Increment"
        >
          ▲
        </button>
        <div className="bg-carbon-600/40 h-px w-full" />
        <button
          type="button"
          tabIndex={-1}
          className="text-silver-400 hover:text-gold-400 flex h-3.5 w-5 items-center justify-center text-[9px] leading-none transition-[transform,color] duration-[var(--motion-fast)] ease-[var(--ease-exit)] hover:duration-[var(--motion-base)] hover:ease-[var(--ease-out)] active:translate-y-[0.5px] active:scale-[0.985] active:duration-[var(--motion-fast)] active:ease-[var(--ease-out)]"
          onMouseDown={stopStepperPropagation}
          onClick={() => stepBy(-1)}
          aria-label="Decrement"
        >
          ▼
        </button>
      </div>
    </div>
  )
})
