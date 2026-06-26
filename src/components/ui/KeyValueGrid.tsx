import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type KeyValueGridProps = {
  title?: string
  children: ReactNode
  className?: string
  cols?: 1 | 2 | 3 | 4
}

export function KeyValueGrid({ title, children, className, cols = 2 }: KeyValueGridProps) {
  return (
    <div
      className={cn('surface-card border-carbon-700/60 rounded-xl border p-4 shadow-sm', className)}
    >
      {title && <h4 className="text-silver-200 mb-3 text-sm font-medium tracking-wide">{title}</h4>}
      <dl
        className={cn(
          'grid gap-3 text-xs',
          cols === 1 && 'grid-cols-1',
          cols === 2 && 'grid-cols-2',
          cols === 3 && 'grid-cols-1 sm:grid-cols-3',
          cols === 4 && 'grid-cols-2 sm:grid-cols-4',
        )}
      >
        {children}
      </dl>
    </div>
  )
}

export type KeyValueItemProps = {
  label: string
  value: ReactNode
  className?: string
  layout?: 'stacked' | 'horizontal'
}

export function KeyValueItem({ label, value, className, layout = 'stacked' }: KeyValueItemProps) {
  if (layout === 'horizontal') {
    return (
      <div
        className={cn(
          'border-carbon-800 bg-carbon-900/10 hover:bg-carbon-900/25 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-all duration-150',
          className,
        )}
      >
        <dt className="text-silver-400 text-[10px] font-medium tracking-wider uppercase">
          {label}
        </dt>
        <dd className="text-silver-200 text-right text-xs font-medium">{value}</dd>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'border-carbon-800 bg-carbon-900/10 hover:bg-carbon-900/20 flex flex-col justify-between gap-1 rounded-lg border px-3 py-2.5 transition-all duration-150',
        className,
      )}
    >
      <dt className="text-silver-400 text-[9px] font-medium tracking-wider uppercase">{label}</dt>
      <dd className="text-silver-200 mt-0.5 text-xs font-semibold">{value}</dd>
    </div>
  )
}
