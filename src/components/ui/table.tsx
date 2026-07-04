import {
  forwardRef,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="q-table-container">
      <table ref={ref} className={cn('q-table', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('q-table-thead', className)} {...props} />
))
TableHeader.displayName = 'TableHeader'

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('q-table-tbody', className)} {...props} />
))
TableBody.displayName = 'TableBody'

export const TableFooter = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn('q-table-tfoot', className)} {...props} />
))
TableFooter.displayName = 'TableFooter'

export type TableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  isSelected?: boolean
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, isSelected, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('q-table-tr', isSelected ? 'is-selected' : undefined, className)}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={cn('q-table-th', className)} {...props} />
  ),
)
TableHead.displayName = 'TableHead'

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('q-table-td', className)} {...props} />
  ),
)
TableCell.displayName = 'TableCell'

export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('q-table-caption', className)} {...props} />
))
TableCaption.displayName = 'TableCaption'
