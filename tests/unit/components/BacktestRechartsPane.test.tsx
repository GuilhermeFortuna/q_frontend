import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BacktestRechartsPane } from '@/components/backtests/BacktestRechartsPane'
import { getMockBacktestResponse } from '@/mocks/backtest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { BacktestPerformance, DrawdownPeriod, EquityPoint } from '@/types/backtesting'

const equityCurve: EquityPoint[] = [
  { timestamp: '2024-01-15T00:00:00Z', equity: 100_000, pnl: 0, drawdown: 0, drawdownPct: 0 },
  {
    timestamp: '2024-01-16T00:00:00Z',
    equity: 95_000,
    pnl: -5_000,
    drawdown: 5_000,
    drawdownPct: 0.05,
  },
]

describe('BacktestRechartsPane performance variant', () => {
  it('keeps the current charts and omits analytics when performance is unavailable', () => {
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
    render(
      <TooltipProvider>
        <BacktestRechartsPane
          variant="performance"
          equityCurve={equityCurve}
          initialCapital={100_000}
          bars={[]}
          trades={[]}
        />
      </TooltipProvider>,
    )

    expect(screen.getByText('Equity Curve')).toBeTruthy()
    expect(screen.getByText('Drawdown')).toBeTruthy()
    expect(screen.queryByText('Trade quality')).toBeNull()
    expect(screen.queryByText('Worst drawdowns')).toBeNull()
    expect(screen.getByText('Rolling metrics')).toBeTruthy()
  })

  it('adds the metrics and worst-drawdowns panels when performance is available', () => {
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
    const { performance: fixturePerformance } = getMockBacktestResponse({ symbol: 'TEST' })
    if (!fixturePerformance) throw new Error('Mock backtest is missing its performance fixture')
    const drawdowns: DrawdownPeriod[] = [
      {
        peak_time: '2024-01-15T00:00:00Z',
        trough_time: '2024-01-16T00:00:00Z',
        recovery_time: null,
        depth_value: 5000,
        depth_pct: 0.05,
        duration_days: 1,
        trades: 2,
      },
      {
        peak_time: '2024-01-15T00:00:00Z',
        trough_time: '2024-01-16T00:00:00Z',
        recovery_time: '2024-01-16T00:00:00Z',
        depth_value: 2500,
        depth_pct: 0.025,
        duration_days: 1,
        trades: 1,
      },
    ]
    const performance: BacktestPerformance = { ...fixturePerformance, drawdowns }
    const { container } = render(
      <TooltipProvider>
        <BacktestRechartsPane
          variant="performance"
          equityCurve={equityCurve}
          initialCapital={100_000}
          bars={[]}
          trades={[]}
          performance={performance}
        />
      </TooltipProvider>,
    )

    expect(screen.getByText('Trade quality')).toBeTruthy()
    expect(screen.getByText('Worst drawdowns')).toBeTruthy()
    expect(screen.getByText('Rolling metrics')).toBeTruthy()
    expect(screen.getByText('Open')).toBeTruthy()
    expect(container.querySelectorAll('.recharts-reference-area')).toHaveLength(2)

    fireEvent.mouseOver(screen.getByText('-5.00%').closest('tr')!)
    expect(container.querySelectorAll('.recharts-reference-area')).toHaveLength(4)
  })
})
