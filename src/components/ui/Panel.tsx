import type { HTMLAttributes, ReactNode } from 'react'

import { GlowCard } from '@/components/ui/spotlight-card'
import { cn } from '@/lib/utils'

export type PanelProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * Legacy living-panel opt-in. Absorbed into GlowCard chrome — kept for API
   * compatibility; no longer stacks `surface-panel--living` (pseudo conflict).
   */
  living?: boolean
}

export function Panel({ className, living: _living = false, ...props }: PanelProps) {
  return <GlowCard intensity="panel" className={cn(className)} {...props} />
}

export type PanelHeaderProps = {
  title: string
  right?: ReactNode
  className?: string
}

export function PanelHeader({ title, right, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-3', className)}>
      <h3 className="accent-wayfinding text-[11px] font-[560] tracking-[0.08em] uppercase">
        {title}
      </h3>
      {right ? <div className="text-silver-400 text-xs">{right}</div> : null}
    </div>
  )
}
