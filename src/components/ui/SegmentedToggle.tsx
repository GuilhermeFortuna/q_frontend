import { useCallback, useId, useRef, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

export type SegmentedOption<T extends string = string> = {
  value: T
  label: string
  disabled?: boolean
}

type SegmentedToggleBaseProps<T extends string> = {
  options: SegmentedOption<T>[]
  className?: string
  'aria-label'?: string
}

export type SegmentedToggleSingleProps<T extends string> = SegmentedToggleBaseProps<T> & {
  mode?: 'single'
  value: T
  onChange: (value: T) => void
}

export type SegmentedToggleMultiProps<T extends string> = SegmentedToggleBaseProps<T> & {
  mode: 'multi'
  values: T[]
  onToggle: (value: T) => void
}

export type SegmentedToggleProps<T extends string = string> =
  | SegmentedToggleSingleProps<T>
  | SegmentedToggleMultiProps<T>

function isMultiProps<T extends string>(
  props: SegmentedToggleProps<T>,
): props is SegmentedToggleMultiProps<T> {
  return props.mode === 'multi'
}

export function SegmentedToggle<T extends string = string>(props: SegmentedToggleProps<T>) {
  const groupId = useId()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const focusAt = useCallback((index: number) => {
    const buttons = buttonRefs.current.filter(Boolean) as HTMLButtonElement[]
    if (buttons.length === 0) return
    const next = ((index % buttons.length) + buttons.length) % buttons.length
    buttons[next]?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const buttons = buttonRefs.current.filter(Boolean) as HTMLButtonElement[]
    const current = buttons.findIndex((btn) => btn === document.activeElement)
    if (current < 0) return
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (current + delta + buttons.length) % buttons.length
    focusAt(nextIndex)
    if (!isMultiProps(props)) {
      const option = props.options[nextIndex]
      if (option && !option.disabled) {
        props.onChange(option.value)
      }
    }
  }

  const multi = isMultiProps(props)

  return (
    <div
      role={multi ? 'group' : 'radiogroup'}
      aria-label={props['aria-label']}
      className={cn('surface-well inline-flex flex-wrap gap-0.5 rounded-lg p-0.5', props.className)}
      onKeyDown={handleKeyDown}
    >
      {props.options.map((option, index) => {
        const selected = multi ? props.values.includes(option.value) : props.value === option.value
        const id = `${groupId}-${option.value}`

        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current[index] = node
            }}
            id={id}
            type="button"
            role={multi ? undefined : 'radio'}
            aria-checked={multi ? undefined : selected}
            aria-pressed={multi ? selected : undefined}
            disabled={option.disabled}
            onClick={() => {
              if (option.disabled) return
              if (multi) {
                props.onToggle(option.value)
              } else {
                props.onChange(option.value)
              }
            }}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold transition-[border-color,box-shadow,transform] duration-150',
              'focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              selected
                ? 'accent-state text-gold-400'
                : 'surface-control text-silver-300 hover:border-brass-500/40 active:scale-95',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
