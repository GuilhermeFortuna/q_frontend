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
        'surface-suede flex cursor-pointer flex-col gap-2 rounded-lg p-3 text-left',
        'transition-[transform,border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-exit)]',
        'focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        !disabled &&
          'hover:-translate-y-0.5 hover:duration-[var(--motion-base)] hover:ease-[var(--ease-out)] active:translate-y-[0.5px] active:scale-[0.985] active:duration-[var(--motion-fast)] active:ease-[var(--ease-out)]',
        selected && 'accent-state',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('text-sm font-[620]', selected ? 'text-gold-400' : 'text-silver-100')}>
          {title}
        </span>
        {tag ? (
          <span className="accent-wayfinding rounded px-1.5 py-0.5 text-[11px] font-[560] tracking-[0.08em] uppercase">
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
