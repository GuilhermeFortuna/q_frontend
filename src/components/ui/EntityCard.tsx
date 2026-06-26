import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type EntityCardProps = {
  title: string
  tag?: string
  description?: string
  meta?: ReactNode
  badges?: ReactNode
  selected?: boolean
  onSelect: () => void
  disabled?: boolean
  className?: string
}

export function EntityCard({
  title,
  tag,
  description,
  meta,
  badges,
  selected = false,
  onSelect,
  disabled = false,
  className,
}: EntityCardProps) {
  const activate = () => {
    if (disabled) return
    onSelect()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      activate()
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={activate}
      onKeyDown={handleKeyDown}
      className={cn(
        'surface-card flex cursor-pointer flex-col gap-2 rounded-lg p-3 text-left transition-[transform,border-color,box-shadow] duration-350',
        'focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        !disabled && 'hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.97]',
        selected && 'accent-state',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn('text-sm font-semibold', selected ? 'text-gold-400' : 'text-silver-100')}
        >
          {title}
        </span>
        {tag ? (
          <span className="accent-wayfinding rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            {tag}
          </span>
        ) : null}
        {badges}
      </div>
      {description ? (
        <p className="text-silver-400 line-clamp-2 text-xs leading-relaxed">{description}</p>
      ) : null}
      {meta ? <div className="text-silver-500 text-[10px]">{meta}</div> : null}
    </div>
  )
}
