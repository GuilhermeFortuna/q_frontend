import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type PanelProps = HTMLAttributes<HTMLDivElement> & {
  /** Opt-in woven texture + cursor light-catch (panel-level only). */
  living?: boolean
}

export function Panel({ className, living = false, ...props }: PanelProps) {
  return (
    <div
      className={cn('surface-panel rounded-lg', living && 'surface-panel--living', className)}
      {...props}
    />
  )
}

export type PanelHeaderProps = {
  title: string
  right?: ReactNode
  className?: string
}

export function PanelHeader({ title, right, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-3', className)}>
      <h3 className="accent-wayfinding text-[10px] font-bold tracking-wider uppercase">{title}</h3>
      {right ? <div className="text-silver-400 text-xs">{right}</div> : null}
    </div>
  )
}
