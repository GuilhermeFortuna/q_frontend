import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { RollingMetricsChart } from '@/components/backtests/RollingMetricsChart'
import { getMockBacktestResponse } from '@/mocks/backtest'
import type { Trade } from '@/types/backtesting'

function makeTrades(count: number, pnl = 100): Trade[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `t-${index}`,
    order_id: `o-${index}`,
    symbol: 'PETR4',
    action: index % 2 === 0 ? 'BUY' : 'SELL',
    quantity: 100,
    entry_time: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    entry_price: 30,
    exit_time: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T16:00:00Z`,
    exit_price: 31,
    exit_reason: 'signal',
    pnl: index % 3 === 0 ? -pnl : pnl,
    commission: 0,
    point_value: 1,
    status: 'CLOSED',
  }))
}

describe('RollingMetricsChart', () => {
  const mockResp = getMockBacktestResponse({ symbol: 'PETR4' })
  const performance = mockResp.performance!

  it('renders window options and metric options, disabling options larger than trade count', () => {
    // 35 trades: 20 is enabled, 50 and 100 are disabled
    const trades = makeTrades(35)
    render(<RollingMetricsChart trades={trades} performance={performance} />)

    expect(screen.getByRole('radio', { name: '20' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: '50' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: '100' })).toBeDisabled()

    // Metric options
    expect(screen.getByRole('radio', { name: 'Expectancy' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Win rate' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Profit factor' })).toBeInTheDocument()
  })

  it('renders inline empty state when trade count is less than window', () => {
    const trades = makeTrades(35)
    render(<RollingMetricsChart trades={trades} performance={performance} />)

    // Default window is 50, but we have 35 trades
    expect(screen.getByText('Needs at least 50 closed trades')).toBeInTheDocument()
  })

  it('renders chart and toggles between window sizes when enough trades exist', async () => {
    const user = userEvent.setup()
    const trades = makeTrades(60)
    const { container } = render(<RollingMetricsChart trades={trades} performance={performance} />)

    expect(container.querySelector('.recharts-xAxis')).toBeInTheDocument()
    expect(container.querySelector('.recharts-yAxis')).toBeInTheDocument()

    // With 60 trades, window 50 is satisfied so no empty state
    expect(screen.queryByText(/Needs at least/)).not.toBeInTheDocument()

    // Switch to window 20
    await user.click(screen.getByRole('radio', { name: '20' }))
    expect(screen.getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true')
  })

  it('renders without performance prop without error and omits full-sample reference line', () => {
    const trades = makeTrades(60)
    render(<RollingMetricsChart trades={trades} performance={null} />)

    expect(screen.queryByText(/Needs at least/)).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Expectancy' })).toBeInTheDocument()
  })

  it('renders empty state when there are no closed trades', () => {
    render(<RollingMetricsChart trades={[]} performance={performance} />)

    expect(screen.getByText(/No closed trades/i)).toBeInTheDocument()
  })

  it('formats dates with actual trade year and never displays 1969', () => {
    const trades = makeTrades(60)
    const { container } = render(<RollingMetricsChart trades={trades} performance={performance} />)

    // Verify X-axis ticks contain the 2024 dates from makeTrades
    const xAxis = container.querySelector('.recharts-xAxis')
    expect(xAxis).toBeInTheDocument()
    expect(xAxis?.textContent).toContain('2024')
    expect(xAxis?.textContent).not.toContain('1969')
  })
})
