import { Fragment, type ReactNode } from 'react'

import { useVirtualList } from '@/hooks/useVirtualList'
import type { VirtualRowMeta } from '@/components/shared/virtualRowMeta'
import { cn } from '@/lib/utils'

type VirtualTableScrollerProps<T> = {
  items: T[]
  rowHeight?: number
  estimateSize?: number | ((index: number) => number)
  className?: string
  tableClassName?: string
  theadClassName?: string
  getItemKey?: (index: number) => string | number
  /** Bust the virtualizer measurement cache when expansion or row height changes. */
  remeasureKey?: unknown
  header: ReactNode
  renderRow: (item: T, index: number, meta?: VirtualRowMeta) => ReactNode
  colSpan: number
}

/**
 * Scrollable table with sticky header. Virtualizes body rows when count exceeds threshold.
 * Uses spacer rows inside a single table so header and body columns stay aligned.
 */
export function VirtualTableScroller<T>({
  items,
  rowHeight = 40,
  estimateSize,
  className,
  tableClassName,
  theadClassName,
  getItemKey,
  remeasureKey,
  header,
  renderRow,
  colSpan,
}: VirtualTableScrollerProps<T>) {
  const { scrollRef, virtualizer, shouldVirtualize } = useVirtualList({
    count: items.length,
    estimateSize: estimateSize ?? rowHeight,
    getItemKey,
    remeasureKey,
  })

  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : []
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1]!.end
      : 0

  const measureElement = virtualizer.measureElement

  let body: ReactNode
  if (!shouldVirtualize) {
    body = items.map((item, index) => (
      <Fragment key={getItemKey?.(index) ?? index}>{renderRow(item, index)}</Fragment>
    ))
  } else {
    body = (
      <>
        {paddingTop > 0 ? (
          <tr aria-hidden="true" className="pointer-events-none border-0">
            <td
              colSpan={colSpan}
              className="border-0 p-0"
              style={{ height: paddingTop, lineHeight: 0 }}
            />
          </tr>
        ) : null}
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index]!
          const rowKey = getItemKey?.(virtualRow.index) ?? virtualRow.key
          const meta: VirtualRowMeta = {
            measureRef: measureElement,
            virtualIndex: virtualRow.index,
          }
          return <Fragment key={rowKey}>{renderRow(item, virtualRow.index, meta)}</Fragment>
        })}
        {paddingBottom > 0 ? (
          <tr aria-hidden="true" className="pointer-events-none border-0">
            <td
              colSpan={colSpan}
              className="border-0 p-0"
              style={{ height: paddingBottom, lineHeight: 0 }}
            />
          </tr>
        ) : null}
      </>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={cn('min-h-0 flex-1 overflow-auto', className)}
      data-virtualized={shouldVirtualize ? 'true' : 'false'}
    >
      <table className={cn('w-full text-left text-xs', tableClassName)}>
        <thead className={cn('text-silver-400 bg-carbon-900 sticky top-0 z-10', theadClassName)}>
          {header}
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  )
}
