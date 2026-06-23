import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { VirtualTableScroller } from '@/components/shared/VirtualTableBody'
import { VIRTUALIZE_THRESHOLD } from '@/lib/virtualization/constants'

vi.mock('@tanstack/react-virtual', () => {
  const useVirtualizer = vi.fn(() => ({
    getTotalSize: () => 60 * 5,
    getVirtualItems: () =>
      Array.from({ length: 5 }, (_, index) => ({
        key: index,
        index,
        start: index * 60,
        end: (index + 1) * 60,
        size: 60,
      })),
    measureElement: vi.fn(),
    measure: vi.fn(),
  }))
  return { useVirtualizer }
})

function buildItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: index, label: `Row ${index}` }))
}

describe('VirtualTableScroller', () => {
  it('renders all rows when below the virtualization threshold', () => {
    const items = buildItems(10)

    const { container } = render(
      <VirtualTableScroller
        items={items}
        colSpan={2}
        header={
          <tr>
            <th>Label</th>
            <th>Id</th>
          </tr>
        }
        renderRow={(item) => (
          <tr>
            <td>{item.label}</td>
            <td>{item.id}</td>
          </tr>
        )}
      />,
    )

    expect(screen.getByText('Row 0')).toBeInTheDocument()
    expect(screen.getByText('Row 9')).toBeInTheDocument()
    expect(screen.queryByText('Row 49')).not.toBeInTheDocument()
    expect(container.querySelector('[data-virtualized="false"]')).toBeTruthy()
    expect(container.querySelectorAll('table')).toHaveLength(1)
  })

  it('virtualizes large lists with a single table and bounded body rows', () => {
    const items = buildItems(VIRTUALIZE_THRESHOLD + 25)

    const { container } = render(
      <VirtualTableScroller
        items={items}
        colSpan={2}
        header={
          <tr>
            <th>Label</th>
            <th>Id</th>
          </tr>
        }
        renderRow={(item) => (
          <tr>
            <td>{item.label}</td>
            <td>{item.id}</td>
          </tr>
        )}
      />,
    )

    const scroller = container.querySelector('[data-virtualized="true"]')
    expect(scroller).toBeTruthy()
    expect(container.querySelectorAll('table')).toHaveLength(1)
    expect(container.querySelectorAll('tbody table')).toHaveLength(0)

    expect(screen.getByText('Row 0')).toBeInTheDocument()
    expect(screen.getByText('Row 4')).toBeInTheDocument()
    expect(screen.queryByText(`Row ${VIRTUALIZE_THRESHOLD}`)).not.toBeInTheDocument()

    const bodyRows = container.querySelectorAll('tbody tr')
    expect(bodyRows.length).toBeLessThan(12)
    expect(bodyRows.length).toBeGreaterThan(0)
  })

  it('keeps header and body column counts aligned when virtualized', () => {
    const items = buildItems(VIRTUALIZE_THRESHOLD + 10)

    const { container } = render(
      <VirtualTableScroller
        items={items}
        colSpan={3}
        header={
          <tr>
            <th>A</th>
            <th>B</th>
            <th>C</th>
          </tr>
        }
        renderRow={(item) => (
          <tr>
            <td>{item.label}</td>
            <td>{item.id}</td>
            <td>extra</td>
          </tr>
        )}
      />,
    )

    const headerCount = container.querySelectorAll('thead th').length
    const dataRow = [...container.querySelectorAll('tbody tr')].find(
      (row) => row.getAttribute('aria-hidden') !== 'true',
    )
    expect(dataRow?.querySelectorAll('td').length).toBe(headerCount)
  })

  it('passes measure metadata to virtualized rows', () => {
    const items = buildItems(VIRTUALIZE_THRESHOLD + 5)

    render(
      <VirtualTableScroller
        items={items}
        colSpan={1}
        header={
          <tr>
            <th>Label</th>
          </tr>
        }
        renderRow={(item, _index, meta) => (
          <tr ref={meta?.measureRef} data-index={meta?.virtualIndex}>
            <td>{item.label}</td>
          </tr>
        )}
      />,
    )

    expect(screen.getByText('Row 0').closest('tr')).toHaveAttribute('data-index', '0')
  })
})
