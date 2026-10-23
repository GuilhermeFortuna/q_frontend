import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CustomEquityTooltip, EquityCurveChart } from '@/components/backtests/EquityCurveChart'
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
  it('renders the equity line chart with fixed height when data is present', () => {
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
})
