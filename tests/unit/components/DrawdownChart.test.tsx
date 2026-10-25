import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CustomDrawdownTooltip, DrawdownChart } from '@/components/backtests/DrawdownChart'
import type { DrawdownPeriod, EquityPoint } from '@/types/backtesting'

const data: EquityPoint[] = [
  { timestamp: '2024-01-15T00:00:00Z', equity: 100_000, pnl: 0, drawdown: 0, drawdownPct: 0 },
  {
    timestamp: '2024-01-16T00:00:00Z',
    equity: 95_000,
    pnl: -5_000,
    drawdown: 5_000,
    drawdownPct: 0.05,
  },
]

const drawdowns: DrawdownPeriod[] = [
  {
    peak_time: '2024-01-15T00:00:00Z',
    trough_time: '2024-01-16T00:00:00Z',
    recovery_time: null,
    depth_value: 5_000,
    depth_pct: 0.05,
    duration_days: 1,
    trades: 1,
  },
]

describe('DrawdownChart', () => {
  it('highlights the selected drawdown period', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 200,
      top: 0,
      left: 0,
      right: 640,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const { container } = render(
      <DrawdownChart data={data} drawdowns={drawdowns} highlightedDrawdownIndex={0} />,
    )

    expect(container.querySelectorAll('.recharts-reference-area').length).toBe(1)
  })

  it('switches between percentage and value units', async () => {
    const user = userEvent.setup()
    render(<DrawdownChart data={data} drawdowns={drawdowns} />)

    expect(screen.getByRole('radio', { name: '%' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: 'Value' }))
    expect(screen.getByRole('radio', { name: 'Value' })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows the drawdown and its containing period on hover', () => {
    const underwater = { ...data[1], x: 2 }

    render(
      <CustomDrawdownTooltip active payload={[{ payload: underwater }]} drawdowns={drawdowns} />,
    )

    // Drawdown row and the period's depth row both show -5.00%.
    expect(screen.getAllByText('-5.00%')).toHaveLength(2)
    expect(screen.getByText('-5,000.00')).toBeTruthy()
    expect(screen.getByText('Drawdown period')).toBeTruthy()
    expect(screen.getByText(/→ ongoing$/)).toBeTruthy()
  })

  it('omits the period section when the hovered point is at a peak', () => {
    const atPeak = { ...data[0], x: 1 }

    render(<CustomDrawdownTooltip active payload={[{ payload: atPeak }]} drawdowns={drawdowns} />)

    expect(screen.queryByText('Drawdown period')).toBeNull()
  })
})
