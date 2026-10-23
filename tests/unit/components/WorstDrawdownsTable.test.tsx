import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WorstDrawdownsTable } from '@/components/backtests/WorstDrawdownsTable'
import type { DrawdownPeriod } from '@/types/backtesting'

const drawdowns: DrawdownPeriod[] = [
  {
    peak_time: '2024-01-10T00:00:00Z',
    trough_time: '2024-01-12T00:00:00Z',
    recovery_time: '2024-01-15T00:00:00Z',
    depth_value: 500,
    depth_pct: 0.05,
    duration_days: 5,
    trades: 3,
  },
  {
    peak_time: '2024-02-01T00:00:00Z',
    trough_time: '2024-02-03T00:00:00Z',
    recovery_time: null,
    depth_value: 250,
    depth_pct: 0.025,
    duration_days: 8,
    trades: 4,
  },
]

describe('WorstDrawdownsTable', () => {
  it('renders drawdowns in supplied order and marks an unrecovered period open', () => {
    render(
      <WorstDrawdownsTable drawdowns={drawdowns} highlightedIndex={null} onHighlight={vi.fn()} />,
    )

    expect(screen.getByText('Worst drawdowns')).toBeTruthy()
    expect(screen.getByText('Open')).toBeTruthy()
    expect(screen.getByText('-5.00%')).toBeTruthy()
    expect(screen.getByText('-2.50%')).toBeTruthy()
  })

  it('highlights a period on pointer and keyboard focus', () => {
    const onHighlight = vi.fn()
    render(
      <WorstDrawdownsTable
        drawdowns={drawdowns}
        highlightedIndex={null}
        onHighlight={onHighlight}
      />,
    )

    const row = screen.getByText('-5.00%').closest('tr')!
    fireEvent.mouseOver(row)
    expect(onHighlight).toHaveBeenLastCalledWith(0)

    fireEvent.focus(row)
    expect(onHighlight).toHaveBeenLastCalledWith(0)
  })
})
