import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type SectionHeaderProps = {
  title: string
  right?: ReactNode
  className?: string
}

export function SectionHeader({ title, right, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h3 className="accent-wayfinding text-[10px] font-bold tracking-wider uppercase">{title}</h3>
      {right ? <div className="text-silver-400 text-xs">{right}</div> : null}
    </div>
  )
}
