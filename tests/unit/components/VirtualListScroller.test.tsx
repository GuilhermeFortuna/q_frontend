import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { VirtualListScroller } from '@/components/shared/VirtualListScroller'
import { VIRTUALIZE_THRESHOLD } from '@/lib/virtualization/constants'

vi.mock('@tanstack/react-virtual', () => {
  const useVirtualizer = vi.fn(() => ({
    getTotalSize: () => 100 * 5,
    getVirtualItems: () =>
      Array.from({ length: 5 }, (_, index) => ({
        key: `item-${index}`,
        index,
        start: index * 100,
        end: (index + 1) * 100,
        size: 100,
      })),
    measureElement: vi.fn(),
    measure: vi.fn(),
  }))
  return { useVirtualizer }
})

function buildItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    label: `Item ${index}`,
  }))
}

describe('VirtualListScroller', () => {
  it('renders keyed non-virtual items without React key warnings', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <VirtualListScroller
        items={buildItems(10)}
        getItemKey={(index) => `item-${index}`}
        renderItem={(item) => <div data-testid="list-item">{item.label}</div>}
      />,
    )

    expect(screen.getAllByTestId('list-item')).toHaveLength(10)
    expect(
      errorSpy.mock.calls.some(([message]) =>
        String(message).includes('Each child in a list should have a unique "key"'),
      ),
    ).toBe(false)

    errorSpy.mockRestore()
  })

  it('virtualizes large lists and bounds visible DOM nodes', () => {
    const items = buildItems(VIRTUALIZE_THRESHOLD + 20)

    const { container } = render(
      <VirtualListScroller
        items={items}
        getItemKey={(index) => items[index]!.id}
        renderItem={(item) => <div data-testid="list-item">{item.label}</div>}
      />,
    )

    expect(container.querySelector('[data-virtualized="true"]')).toBeTruthy()
    expect(screen.getAllByTestId('list-item').length).toBeLessThan(10)
    expect(screen.getByText('Item 0')).toBeInTheDocument()
    expect(screen.queryByText(`Item ${VIRTUALIZE_THRESHOLD + 10}`)).not.toBeInTheDocument()
  })
})
