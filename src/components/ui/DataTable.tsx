import { Fragment, memo, useMemo, useState, type ReactNode, type ReactElement } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useVirtualList } from '@/hooks/useVirtualList'
import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { cn } from '@/lib/utils'

export type DataColumn<T> = {
  id: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  numeric?: boolean
  tone?: 'signed' | 'neutral'
  sortable?: boolean
  width?: string | number
  minWidth?: string | number
  sticky?: boolean
  render?: (row: T, index: number) => ReactNode
}

export type DataTableVirtualizeOptions = {
  rowHeight?: number
  estimateSize?: number | ((index: number) => number)
  remeasureKey?: unknown
}

export type DataTableProps<T> = {
  columns: DataColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  selectedKey?: string | number | null
  isRowHighlighted?: (row: T) => boolean
  getRowClassName?: (row: T) => string | undefined
  onRowClick?: (row: T) => void
  onRowMouseEnter?: (row: T) => void
  onRowMouseLeave?: () => void
  expandedKey?: string | number | null
  renderExpandedRow?: (row: T) => ReactNode
  sort?: { columnId: string; direction: 'asc' | 'desc' } | null
  onSortChange?: (sort: { columnId: string; direction: 'asc' | 'desc' } | null) => void
  emptyState?: ReactNode
  loading?: boolean
  virtualize?: DataTableVirtualizeOptions
  scrollContainerClassName?: string
  tableClassName?: string
  theadClassName?: string
  'data-testid'?: string
  className?: string
}

type RowProps<T> = {
  row: T
  rowIndex: number
  columns: DataColumn<T>[]
  isSelected: boolean
  rowKeyVal: string | number
  rowClassName?: string
  measureRef?: (element: Element | null) => void
  virtualIndex?: number
}

const Row = memo(function RowInner<T>({
  row,
  rowIndex,
  columns,
  isSelected,
  rowKeyVal,
  rowClassName,
  measureRef,
  virtualIndex,
}: RowProps<T>) {
  return (
    <TableRow
      isSelected={isSelected}
      data-row-key={rowKeyVal}
      data-index={virtualIndex}
      ref={measureRef}
      className={rowClassName}
    >
      {columns.map((col) => {
        const alignClass =
          col.align === 'right'
            ? 'text-right'
            : col.align === 'center'
              ? 'text-center'
              : 'text-left'

        const numericClass = col.numeric ? 'quant-tabular-nums font-sans' : ''

        let content: ReactNode
        if (col.render) {
          content = col.render(row, rowIndex)
        } else {
          content = String(row[col.id as keyof T] ?? '')
        }

        let toneClass = ''
        if (col.tone === 'signed') {
          const rawVal = row[col.id as keyof T]
          const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal))
          if (!isNaN(num)) {
            if (num > 0) toneClass = 'text-emerald-400 font-medium'
            else if (num < 0) toneClass = 'text-rose-400 font-medium'
            else toneClass = 'text-silver-400'
          }
        }

        const stickyClass = col.sticky
          ? 'sticky left-0 z-10 bg-[#12110f] border-r border-carbon-700/60 shadow-[2px_0_5px_rgba(0,0,0,0.4)]'
          : ''

        return (
          <TableCell
            key={col.id}
            className={cn(alignClass, numericClass, toneClass, stickyClass)}
            style={{
              width: col.width,
              minWidth: col.minWidth,
            }}
          >
            {content}
          </TableCell>
        )
      })}
    </TableRow>
  )
}) as <T>(props: RowProps<T>) => ReactElement | null

function findRowFromEvent<T>(
  event: React.MouseEvent<HTMLTableSectionElement>,
  rows: T[],
  rowKey: (row: T) => string | number,
): T | null {
  const tr = (event.target as HTMLElement).closest('tr[data-row-key]')
  if (!tr || !event.currentTarget.contains(tr)) return null

  const key = tr.getAttribute('data-row-key')
  if (key === null) return null

  return rows.find((r) => String(rowKey(r)) === key) ?? null
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  selectedKey,
  isRowHighlighted,
  getRowClassName,
  onRowClick,
  onRowMouseEnter,
  onRowMouseLeave,
  expandedKey,
  renderExpandedRow,
  sort,
  onSortChange,
  emptyState,
  loading = false,
  virtualize,
  scrollContainerClassName,
  tableClassName,
  theadClassName,
  'data-testid': testId,
  className,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<{
    columnId: string
    direction: 'asc' | 'desc'
  } | null>(null)

  const reducedMotion = useReducedMotion()

  const activeSort = onSortChange ? sort : internalSort

  const { scrollRef, virtualizer, shouldVirtualize } = useVirtualList({
    count: rows.length,
    estimateSize: virtualize?.estimateSize ?? virtualize?.rowHeight ?? 40,
    getItemKey: (index) => rowKey(rows[index]!),
    remeasureKey: virtualize?.remeasureKey ?? expandedKey,
    threshold: virtualize ? undefined : Number.MAX_SAFE_INTEGER,
  })

  const handleHeaderClick = (colId: string) => {
    if (!onSortChange) {
      setInternalSort((prev) => {
        if (prev?.columnId === colId) {
          if (prev.direction === 'asc') {
            return { columnId: colId, direction: 'desc' }
          }
          return null
        }
        return { columnId: colId, direction: 'asc' }
      })
    } else {
      if (activeSort?.columnId === colId) {
        if (activeSort.direction === 'asc') {
          onSortChange({ columnId: colId, direction: 'desc' })
        } else {
          onSortChange(null)
        }
      } else {
        onSortChange({ columnId: colId, direction: 'asc' })
      }
    }
  }

  const handleTbodyClick = (event: React.MouseEvent<HTMLTableSectionElement>) => {
    if (!onRowClick) return
    const clickedRow = findRowFromEvent(event, rows, rowKey)
    if (clickedRow) onRowClick(clickedRow)
  }

  const handleTbodyMouseOver = (event: React.MouseEvent<HTMLTableSectionElement>) => {
    if (!onRowMouseEnter) return
    const hoveredRow = findRowFromEvent(event, rows, rowKey)
    if (hoveredRow) onRowMouseEnter(hoveredRow)
  }

  const handleTbodyMouseLeave = () => {
    onRowMouseLeave?.()
  }

  const sortedRows = useMemo(() => {
    if (onSortChange) return rows
    if (!activeSort) return rows

    return [...rows]
      .map((row, idx) => ({ row, idx }))
      .sort((a, b) => {
        const valA = a.row[activeSort.columnId as keyof T]
        const valB = b.row[activeSort.columnId as keyof T]

        if (valA === undefined || valA === null) return 1
        if (valB === undefined || valB === null) return -1

        if (typeof valA === 'number' && typeof valB === 'number') {
          if (valA === valB) return a.idx - b.idx
          return activeSort.direction === 'asc' ? valA - valB : valB - valA
        }

        const strA = String(valA).toLowerCase()
        const strB = String(valB).toLowerCase()
        if (strA === strB) return a.idx - b.idx
        if (strA < strB) return activeSort.direction === 'asc' ? -1 : 1
        if (strA > strB) return activeSort.direction === 'asc' ? 1 : -1
        return 0
      })
      .map((item) => item.row)
  }, [rows, activeSort, onSortChange])

  const renderSortIndicator = (colId: string) => {
    if (activeSort?.columnId !== colId) {
      return (
        <span className="ml-1 inline-block text-[9px] opacity-0 transition-opacity duration-[var(--motion-fast)] ease-out group-hover:opacity-40">
          ▲
        </span>
      )
    }
    return (
      <span className="text-gold-400 ml-1 inline-block text-[9px] transition-transform duration-[var(--motion-fast)]">
        {activeSort.direction === 'asc' ? '▲' : '▼'}
      </span>
    )
  }

  const pulseClass = reducedMotion ? '' : 'animate-pulse animate-duration-1000'
  const columnCount = columns.length

  const isRowSelected = (row: T, keyVal: string | number) => {
    if (isRowHighlighted) return isRowHighlighted(row)
    return selectedKey !== undefined && selectedKey !== null && selectedKey === keyVal
  }

  const renderDataRow = (
    row: T,
    rowIndex: number,
    measureRef?: (element: Element | null) => void,
  ) => {
    const keyVal = rowKey(row)
    const expanded = expandedKey != null && expandedKey === keyVal

    return (
      <Fragment key={keyVal}>
        <Row
          row={row}
          rowIndex={rowIndex}
          columns={columns}
          isSelected={isRowSelected(row, keyVal)}
          rowKeyVal={keyVal}
          rowClassName={getRowClassName?.(row)}
          measureRef={measureRef}
          virtualIndex={rowIndex}
        />
        {expanded && renderExpandedRow ? (
          <TableRow>
            <TableCell colSpan={columnCount} className="bg-carbon-950/40 py-4">
              {renderExpandedRow(row)}
            </TableCell>
          </TableRow>
        ) : null}
      </Fragment>
    )
  }

  const renderBodyContent = () => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, rIdx) => (
        <TableRow key={`skeleton-${rIdx}`} className={pulseClass}>
          {columns.map((col) => {
            const stickyClass = col.sticky
              ? 'sticky left-0 z-10 bg-[#12110f] border-r border-carbon-700/60'
              : ''
            return (
              <TableCell key={col.id} className={stickyClass}>
                <div className="bg-carbon-800/80 my-1 h-3 w-5/6 rounded" />
              </TableCell>
            )
          })}
        </TableRow>
      ))
    }

    if (sortedRows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={columnCount} className="text-silver-500 py-8 text-center">
            {emptyState || 'No results found.'}
          </TableCell>
        </TableRow>
      )
    }

    if (virtualize && shouldVirtualize) {
      const virtualItems = virtualizer.getVirtualItems()
      const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0
      const paddingBottom =
        virtualItems.length > 0
          ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1]!.end
          : 0
      const measureElement = virtualizer.measureElement

      return (
        <>
          {paddingTop > 0 ? (
            <TableRow aria-hidden="true" className="pointer-events-none border-0">
              <TableCell
                colSpan={columnCount}
                className="border-0 p-0"
                style={{ height: paddingTop, lineHeight: 0 }}
              />
            </TableRow>
          ) : null}
          {virtualItems.map((virtualRow) => {
            const row = sortedRows[virtualRow.index]!
            return renderDataRow(row, virtualRow.index, measureElement)
          })}
          {paddingBottom > 0 ? (
            <TableRow aria-hidden="true" className="pointer-events-none border-0">
              <TableCell
                colSpan={columnCount}
                className="border-0 p-0"
                style={{ height: paddingBottom, lineHeight: 0 }}
              />
            </TableRow>
          ) : null}
        </>
      )
    }

    return sortedRows.map((row, index) => renderDataRow(row, index))
  }

  const headerRow = (
    <TableRow>
      {columns.map((col) => {
        const alignClass =
          col.align === 'right'
            ? 'text-right'
            : col.align === 'center'
              ? 'text-center'
              : 'text-left'
        const stickyClass = col.sticky
          ? 'sticky left-0 z-20 bg-[#141311] border-r border-carbon-700/60 shadow-[2px_0_5px_rgba(0,0,0,0.4)]'
          : ''

        return (
          <TableHead
            key={col.id}
            className={cn(
              alignClass,
              col.sortable && 'group cursor-pointer select-none',
              stickyClass,
            )}
            style={{
              width: col.width,
              minWidth: col.minWidth,
            }}
            onClick={col.sortable ? () => handleHeaderClick(col.id) : undefined}
            data-testid={testId ? `${testId}-th-${col.id}` : undefined}
          >
            <div
              className={cn(
                'inline-flex items-center',
                col.align === 'right' && 'w-full justify-end',
                col.align === 'center' && 'w-full justify-center',
              )}
            >
              {col.header}
              {col.sortable && renderSortIndicator(col.id)}
            </div>
          </TableHead>
        )
      })}
    </TableRow>
  )

  const tableBody = (
    <TableBody
      onClick={handleTbodyClick}
      onMouseOver={onRowMouseEnter ? handleTbodyMouseOver : undefined}
      onMouseLeave={onRowMouseLeave ? handleTbodyMouseLeave : undefined}
    >
      {renderBodyContent()}
    </TableBody>
  )

  if (virtualize) {
    return (
      <div
        ref={scrollRef}
        className={cn('q-table-container min-h-0 flex-1 overflow-auto', scrollContainerClassName)}
        data-virtualized={shouldVirtualize ? 'true' : 'false'}
        data-testid={testId}
      >
        <table className={cn('q-table', tableClassName, className)}>
          <TableHeader className={cn('sticky top-0 z-10', theadClassName)}>{headerRow}</TableHeader>
          {tableBody}
        </table>
      </div>
    )
  }

  return (
    <Table className={className} data-testid={testId}>
      <TableHeader className={theadClassName}>{headerRow}</TableHeader>
      {tableBody}
    </Table>
  )
}
