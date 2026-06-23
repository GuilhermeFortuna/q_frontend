import type { ReactNode } from 'react'

import { useVirtualList } from '@/hooks/useVirtualList'
import { cn } from '@/lib/utils'

type VirtualListScrollerProps<T> = {
  items: T[]
  rowHeight?: number
  estimateSize?: number | ((index: number) => number)
  className?: string
  getItemKey?: (index: number) => string | number
  remeasureKey?: unknown
  renderItem: (item: T, index: number) => ReactNode
}

/** Virtualized vertical list for card-style rows (history panels, etc.). */
export function VirtualListScroller<T>({
  items,
  rowHeight = 88,
  estimateSize,
  className,
  getItemKey,
  remeasureKey,
  renderItem,
}: VirtualListScrollerProps<T>) {
  const { scrollRef, virtualizer, shouldVirtualize } = useVirtualList({
    count: items.length,
    estimateSize: estimateSize ?? rowHeight,
    getItemKey,
    remeasureKey,
  })

  if (items.length === 0) {
    return null
  }

  return (
    <div
      ref={scrollRef}
      className={cn('min-h-0 overflow-y-auto', className)}
      data-virtualized={shouldVirtualize ? 'true' : 'false'}
    >
      {shouldVirtualize ? (
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index]!
            return (
              <div
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute top-0 left-0 w-full pb-2"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {renderItem(item, virtualRow.index)}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={getItemKey?.(index) ?? index}>{renderItem(item, index)}</div>
          ))}
        </div>
      )}
    </div>
  )
}
