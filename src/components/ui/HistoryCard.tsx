import type { KeyboardEvent, ReactNode } from 'react'
import { Star } from 'lucide-react'

import { GlowCard } from '@/components/ui/spotlight-card'
import { cn } from '@/lib/utils'

export type HistoryCardProps = {
  title: string
  subtitle: string
  status?: string
  statusClassName?: string

  // Selection mode props
  selectionMode?: boolean
  checked?: boolean
  onToggleCheck?: () => void

  // Star/Favorite props
  showSaved?: boolean
  isSaved?: boolean
  onToggleSaved?: () => void
  saving?: boolean

  selected?: boolean
  onSelect: () => void

  // Footer/Metrics area
  metrics?: ReactNode

  className?: string
}

export function HistoryCard({
  title,
  subtitle,
  status,
  statusClassName,
  selectionMode = false,
  checked = false,
  onToggleCheck,
  showSaved = false,
  isSaved = false,
  onToggleSaved,
  saving = false,
  selected = false,
  onSelect,
  metrics,
  className,
}: HistoryCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (selectionMode) {
        onToggleCheck?.()
      } else {
        onSelect()
      }
    }
  }

  const handleContainerClick = () => {
    if (selectionMode) {
      onToggleCheck?.()
    } else {
      onSelect()
    }
  }

  return (
    <GlowCard
      intensity="card"
      role="button"
      tabIndex={0}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
      aria-pressed={selected}
      className={cn(
        'relative flex w-full cursor-pointer flex-col gap-2 p-3 text-left',
        'transition-[transform,border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-exit)]',
        'focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'hover:-translate-y-0.5 hover:duration-[var(--motion-base)] hover:ease-[var(--ease-out)] active:translate-y-[0.5px] active:scale-[0.985] active:duration-[var(--motion-fast)] active:ease-[var(--ease-out)]',
        selected && !selectionMode && 'accent-state border-brass-500/50',
        selectionMode && checked && 'accent-state border-brass-500/40',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        {selectionMode && onToggleCheck ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              e.stopPropagation()
              onToggleCheck()
            }}
            onClick={(e) => e.stopPropagation()}
            className="border-carbon-500 text-brass-500 mt-1 h-3.5 w-3.5 shrink-0 rounded"
            aria-label={`Select item`}
          />
        ) : null}

        <div className="min-w-0 flex-1 pr-4">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                'truncate text-sm leading-snug font-semibold',
                selected ? 'text-gold-400' : 'text-silver-100',
              )}
            >
              {title}
            </h4>
            {status && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide capitalize',
                  statusClassName,
                )}
              >
                {status}
              </span>
            )}
          </div>
          <p className="text-silver-400 mt-0.5 text-xs font-medium">{subtitle}</p>
        </div>

        {showSaved && onToggleSaved && !selectionMode ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSaved()
            }}
            disabled={saving}
            className={cn(
              'absolute top-2 right-2 rounded p-1 transition-colors disabled:opacity-50',
              isSaved
                ? 'text-brass-400 hover:bg-brass-500/10'
                : 'text-silver-500 hover:bg-brass-500/10 hover:text-brass-400',
            )}
            aria-label={isSaved ? 'Unsave item' : 'Save item'}
          >
            <Star className={cn('h-3.5 w-3.5', isSaved ? 'fill-current' : null)} />
          </button>
        ) : null}
      </div>

      {metrics && (
        <div className="border-carbon-800/60 mt-0.5 border-t pt-2 text-[10px]">{metrics}</div>
      )}
    </GlowCard>
  )
}
