import { chipClass } from '@/components/ui/chipStyles'
import { cn } from '@/lib/utils'

export type FilterPillOption<T extends string = string> = {
  value: T
  label: string
}

export type FilterPillsProps<T extends string = string> = {
  options: FilterPillOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  'aria-label'?: string
}

export function FilterPills<T extends string = string>({
  options,
  value,
  onChange,
  className,
  'aria-label': ariaLabel = 'Category filters',
}: FilterPillsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                onChange(option.value)
              }
            }}
            className={chipClass(active)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
