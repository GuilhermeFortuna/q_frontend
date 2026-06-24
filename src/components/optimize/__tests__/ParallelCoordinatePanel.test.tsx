import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ParallelCoordinatePanel } from '@/components/optimize/ParallelCoordinatePanel'
import type { ParallelCoordinatePayload } from '@/types/optimization'

vi.mock('@visx/responsive', () => ({
  ParentSize: ({ children }: { children: (args: { width: number; height: number }) => unknown }) =>
    children({ width: 640, height: 280 }),
}))

describe('ParallelCoordinatePanel', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 640,
      height: 280,
      top: 0,
      left: 0,
      right: 640,
      bottom: 280,
      toJSON: () => ({}),
    } as DOMRect)
  })

  it('renders one line path per completed trial row', () => {
    const payload: ParallelCoordinatePayload = {
      params: ['short_period', 'long_period'],
      objectives: ['return'],
      rows: [
        { number: 0, params: { short_period: 2, long_period: 20 }, values: [0.2] },
        { number: 1, params: { short_period: 3, long_period: 21 }, values: [0.5] },
      ],
    }

    const { container } = render(<ParallelCoordinatePanel payload={payload} />)
    expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(2)
  })

  it('handles a categorical param axis', () => {
    const payload: ParallelCoordinatePayload = {
      params: ['mode'],
      objectives: ['return'],
      rows: [
        { number: 0, params: { mode: 'fast' }, values: [0.2] },
        { number: 1, params: { mode: 'slow' }, values: [0.5] },
      ],
    }

    const { getByText } = render(<ParallelCoordinatePanel payload={payload} />)
    expect(getByText('Parallel Coordinate')).not.toBeNull()
  })

  it('shows empty state for empty rows', () => {
    const payload: ParallelCoordinatePayload = {
      params: [],
      objectives: ['return'],
      rows: [],
    }

    const { getByText } = render(<ParallelCoordinatePanel payload={payload} />)
    expect(getByText(/Trial polylines will appear here/)).not.toBeNull()
  })
})
