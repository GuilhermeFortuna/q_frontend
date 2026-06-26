import type { ReactNode } from 'react'

import { EntityCard } from '@/components/ui/EntityCard'

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
    <>
      <EntityCard
        title={title}
        tag={tag}
        description={description}
        meta={paramCount != null ? `${paramCount} param${paramCount === 1 ? '' : 's'}` : undefined}
        badges={badges}
        selected={selected}
        onSelect={onClick}
      />
      {trailing}
    </>
  )
}
