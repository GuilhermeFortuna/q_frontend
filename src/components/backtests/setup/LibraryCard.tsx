import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type LibraryCardProps = {
  title: string
  tag?: string
  description: string
  paramCount?: number
  selected: boolean
  onClick: () => void
  trailing?: ReactNode
  badges?: ReactNode
}

export function LibraryCard({
  title,
  tag,
  description,
  paramCount,
  selected,
  onClick,
  trailing,
  badges,
}: LibraryCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'quant-panel border-carbon-600/50 hover:border-brass-500/30 cubic-bezier(0.16,1,0.3,1) flex flex-col gap-2 rounded-lg border p-3 text-left transition-[transform,border-color,box-shadow] duration-350 hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.97]',
        selected &&
          'quant-panel--glow quant-panel--active-run border-brass-500/60 bg-brass-600/10 ring-brass-500/20 ring-1',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-silver-100 text-sm font-semibold">{title}</span>
        {tag ? (
          <span className="bg-carbon-800/80 text-brass-400/90 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            {tag}
          </span>
        ) : null}
        {badges}
      </div>
      <p className="text-silver-400 line-clamp-2 text-xs leading-relaxed">{description}</p>
      {paramCount != null ? (
        <p className="text-silver-500 text-[10px]">
          {paramCount} param{paramCount === 1 ? '' : 's'}
        </p>
      ) : null}
      {trailing}
    </button>
  )
}
