import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CustomEquityTooltip, EquityCurveChart } from '@/components/backtests/EquityCurveChart'
import type { DrawdownPeriod } from '@/types/backtesting'
import type { EquityPoint } from '@/types/backtesting'

const samplePoints: EquityPoint[] = [
  {
    timestamp: '2024-01-15T00:00:00Z',
    equity: 100_003.2,
    pnl: 3.2,
    drawdown: 0,
    drawdownPct: 0,
  },
]

describe('EquityCurveChart', () => {
  it('renders the equity line chart at 16:9 when data is present', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 260,
      top: 0,
      left: 0,
      right: 640,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    render(<EquityCurveChart data={samplePoints} initialCapital={100_000} />)

    expect(screen.getByText('Equity Curve')).toBeTruthy()
    expect(document.querySelector('.recharts-responsive-container')).toBeTruthy()
    expect(document.querySelector('.recharts-line')).toBeTruthy()
  })

  it('shows a fractional drawdown as a percentage in the tooltip', () => {
    const point: EquityPoint = {
      timestamp: '2024-01-15T00:00:00Z',
      equity: 95_000,
      pnl: -5_000,
      drawdown: 5_000,
      drawdownPct: 0.05,
    }

    render(<CustomEquityTooltip active payload={[{ payload: point }]} />)

    expect(screen.getByText('-5.00%')).toBeTruthy()
  })

  it('shades the three deepest periods and emphasizes a selected period', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 260,
      top: 0,
      left: 0,
      right: 640,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const chartPoints: EquityPoint[] = [
      ...samplePoints,
      {
        timestamp: '2024-01-16T00:00:00Z',
        equity: 95_000,
        pnl: -5_000,
        drawdown: 5_000,
        drawdownPct: 0.05,
      },
    ]
    const drawdowns: DrawdownPeriod[] = Array.from({ length: 4 }, (_, index) => ({
      peak_time: '2024-01-15T00:00:00Z',
      trough_time: '2024-01-15T12:00:00Z',
      recovery_time: '2024-01-16T00:00:00Z',
      depth_value: 500 - index * 50,
      depth_pct: 0.05 - index * 0.005,
      duration_days: 1,
      trades: 2,
    }))

    const { container } = render(
      <EquityCurveChart
        data={chartPoints}
        initialCapital={100_000}
        drawdowns={drawdowns}
        highlightedDrawdownIndex={3}
      />,
    )

    expect(container.querySelectorAll('.recharts-reference-area').length).toBe(4)
  })

  it('reports X-axis mode changes when the toggle is used', async () => {
    const user = userEvent.setup()
    const onXModeChange = vi.fn()

    render(
      <EquityCurveChart
        data={samplePoints}
        initialCapital={100_000}
        xMode="time"
        onXModeChange={onXModeChange}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Time' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: 'Trades' }))
    expect(onXModeChange).toHaveBeenCalledWith('trades')
  })

  it('offers the log Y scale only when every equity value is positive', () => {
    const negativePoints: EquityPoint[] = [{ ...samplePoints[0], equity: -250 }]

    const { unmount } = render(<EquityCurveChart data={samplePoints} initialCapital={100_000} />)
    expect(screen.getByRole('radio', { name: 'Log' })).toBeEnabled()
    unmount()

    render(<EquityCurveChart data={negativePoints} initialCapital={100_000} />)
    expect(screen.getByRole('radio', { name: 'Log' })).toBeDisabled()
  })
})
