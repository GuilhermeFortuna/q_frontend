import { chipClass } from '@/components/ui/chipStyles'
import { cn } from '@/lib/utils'

export type RangeChipOption<T extends string = string> = {
  value: T
  label: string
  title?: string
}

export type RangeChipsProps<T extends string = string> = {
  options: RangeChipOption<T>[]
  value: T | null
  onSelect: (value: T) => void
  className?: string
  'aria-label'?: string
}

export function RangeChips<T extends string = string>({
  options,
  value,
  onSelect,
  className,
  'aria-label': ariaLabel = 'Range presets',
}: RangeChipsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            onClick={() => onSelect(option.value)}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                onSelect(option.value)
              }
            }}
            className={chipClass(selected)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
