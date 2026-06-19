import {
  forwardRef,
  useEffect,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
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

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    onChange,
    integer = false,
    nullable = false,
    emptyOnBlur,
    className,
    onBlur,
    onFocus,
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

  return (
    <input
      ref={ref}
      type="number"
      {...props}
      className={cn(className)}
      value={draft}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  )
})
