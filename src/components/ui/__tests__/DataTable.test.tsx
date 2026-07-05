import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataTable, type DataColumn } from '@/components/ui/DataTable'

interface TestRow {
  id: string
  name: string
  value: number
}

const cols: DataColumn<TestRow>[] = [
  { id: 'id', header: 'ID', align: 'left' },
  { id: 'name', header: 'Name', align: 'center', sortable: true },
  { id: 'value', header: 'Value', align: 'right', numeric: true, tone: 'signed', sortable: true },
]

const testRows: TestRow[] = [
  { id: '1', name: 'Alpha', value: 100 },
  { id: '2', name: 'Beta', value: -50 },
  { id: '3', name: 'Gamma', value: 0 },
]

describe('DataTable primitive', () => {
  it('renders columns with correct alignment classes and numeric cells with tabular-nums', () => {
    render(<DataTable columns={cols} rows={testRows} rowKey={(r) => r.id} />)

    // Verify headers render
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()

    // Verify cell alignments
    const cells = screen.getAllByRole('cell')
    // Row 1
    expect(cells[0]).toHaveClass('text-left')
    expect(cells[1]).toHaveClass('text-center')
    expect(cells[2]).toHaveClass('text-right')

    // Numeric cell must carry tabular-nums class
    expect(cells[2]).toHaveClass('quant-tabular-nums')
    expect(cells[2]).toHaveClass('font-sans')
  })

  it('colors positive/negative values according to tone: signed', () => {
    render(<DataTable columns={cols} rows={testRows} rowKey={(r) => r.id} />)

    const cells = screen.getAllByRole('cell')
    // Value 100 (positive)
    expect(cells[2]).toHaveClass('text-emerald-400')
    // Value -50 (negative)
    expect(cells[5]).toHaveClass('text-rose-400')
    // Value 0 (neutral)
    expect(cells[8]).toHaveClass('text-silver-400')
  })

  it('calls onSortChange on header click in controlled mode', () => {
    const handleSortChange = vi.fn()
    const { rerender } = render(
      <DataTable
        columns={cols}
        rows={testRows}
        rowKey={(r) => r.id}
        sort={null}
        onSortChange={handleSortChange}
      />,
    )

    // Click value header when sort is null -> calls with asc
    const headerBtn = screen.getByText('Value')
    fireEvent.click(headerBtn)
    expect(handleSortChange).toHaveBeenCalledWith({ columnId: 'value', direction: 'asc' })

    // Click value header when sort is asc -> calls with desc
    handleSortChange.mockClear()
    rerender(
      <DataTable
        columns={cols}
        rows={testRows}
        rowKey={(r) => r.id}
        sort={{ columnId: 'value', direction: 'asc' }}
        onSortChange={handleSortChange}
      />,
    )
    fireEvent.click(headerBtn)
    expect(handleSortChange).toHaveBeenCalledWith({ columnId: 'value', direction: 'desc' })

    // Click value header when sort is desc -> calls with null
    handleSortChange.mockClear()
    rerender(
      <DataTable
        columns={cols}
        rows={testRows}
        rowKey={(r) => r.id}
        sort={{ columnId: 'value', direction: 'desc' }}
        onSortChange={handleSortChange}
      />,
    )
    fireEvent.click(headerBtn)
    expect(handleSortChange).toHaveBeenCalledWith(null)
  })

  it('sorts rows uncontrolled and is stable for equal keys', () => {
    const testRowsForStable = [
      { id: '1', name: 'Alpha', value: 100 },
      { id: '2', name: 'Beta', value: 100 },
      { id: '3', name: 'Gamma', value: 50 },
    ]
    render(<DataTable columns={cols} rows={testRowsForStable} rowKey={(r) => r.id} />)

    // Uncontrolled sort: click Value header to sort ascending
    const headerBtn = screen.getByText('Value')
    fireEvent.click(headerBtn)

    const cells = screen.getAllByRole('cell')
    // Expected order: Gamma (50), Alpha (100), Beta (100) (stable sort keeps Alpha before Beta)
    expect(cells[2]).toHaveTextContent('50')
    expect(cells[5]).toHaveTextContent('100')
    expect(cells[8]).toHaveTextContent('100')

    expect(cells[4]).toHaveTextContent('Alpha')
    expect(cells[7]).toHaveTextContent('Beta')
  })

  it('handles selectedKey class and row selection click delegation', () => {
    const handleRowClick = vi.fn()
    render(
      <DataTable
        columns={cols}
        rows={testRows}
        rowKey={(r) => r.id}
        selectedKey="2"
        onRowClick={handleRowClick}
      />,
    )

    const tableRows = screen.getAllByRole('row').slice(1) // exclude header row
    expect(tableRows[0]).not.toHaveClass('is-selected')
    expect(tableRows[1]).toHaveClass('is-selected')

    // Click row 3
    fireEvent.click(tableRows[2])
    expect(handleRowClick).toHaveBeenCalledWith(testRows[2])
  })

  it('renders loading states and empty states correctly', () => {
    const { rerender } = render(
      <DataTable columns={cols} rows={[]} rowKey={(r) => r.id} emptyState="Custom Empty Content" />,
    )
    expect(screen.getByText('Custom Empty Content')).toBeInTheDocument()

    rerender(<DataTable columns={cols} rows={testRows} rowKey={(r) => r.id} loading={true} />)
    const rows = screen.getAllByRole('row').slice(1)
    // Loading renders 5 skeleton rows
    expect(rows.length).toBe(5)
  })

  it('preserves row element DOM identities on re-renders if keys match', () => {
    const { rerender } = render(<DataTable columns={cols} rows={testRows} rowKey={(r) => r.id} />)
    const rowsBefore = screen.getAllByRole('row').slice(1)
    const firstRowBefore = rowsBefore[0]

    // Re-render with same rows but different array instance
    rerender(<DataTable columns={cols} rows={[...testRows]} rowKey={(r) => r.id} />)
    const rowsAfter = screen.getAllByRole('row').slice(1)
    const firstRowAfter = rowsAfter[0]

    expect(firstRowBefore).toBe(firstRowAfter)
  })
})
