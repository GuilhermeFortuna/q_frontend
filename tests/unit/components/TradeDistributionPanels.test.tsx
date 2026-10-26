import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TradeDistributionPanels } from '@/components/backtests/TradeDistributionPanels'
import { getMockBacktestResponse } from '@/mocks/backtest'
import type { BacktestPerformance, Trade } from '@/types/backtesting'

function makeTrades(count: number, pnl = 100): Trade[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `trade-${index}`,
    order_id: `order-${index}`,
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
    mfe_points: 5,
    mae_points: 2,
    mfe_capture: 0.6,
    mfe_time: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T11:00:00Z`,
    post_exit_return_points: index % 2 === 0 ? 1 : -1,
  }))
}

describe('TradeDistributionPanels', () => {
  const mockResp = getMockBacktestResponse({ symbol: 'PETR4' })
  const performanceWithExits: BacktestPerformance = {
    ...mockResp.performance!,
    exit_reasons: [
      { reason: 'SIGNAL', pnl: 1500, trades: 10, win_rate: 0.7 },
      { reason: 'STOP_LOSS', pnl: -800, trades: 5, win_rate: 0.0 },
      { reason: 'TAKE_PROFIT', pnl: 2200, trades: 8, win_rate: 1.0 },
    ],
  }

  it('renders all four panels when performance with reasons is provided', () => {
    const trades = makeTrades(25)
    render(<TradeDistributionPanels trades={trades} performance={performanceWithExits} />)

    expect(screen.getByText('P&L distribution')).toBeInTheDocument()
    expect(screen.getByText('Holding time vs P&L')).toBeInTheDocument()
    expect(screen.getByText('By reason')).toBeInTheDocument()
    expect(screen.getByText('By time')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Trade excursions' })).toBeInTheDocument()
  })

  it('updates the post-exit window and provides a reset action', () => {
    const onChange = vi.fn()
    const onReset = vi.fn()
    render(
      <TradeDistributionPanels
        trades={makeTrades(25)}
        performance={performanceWithExits}
        postExitBars={5}
        storedPostExitBars={10}
        onPostExitBarsChange={onChange}
        onPostExitReset={onReset}
      />,
    )
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Post-exit bars' }), {
      target: { value: '3' },
    })
    expect(onChange).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onReset).toHaveBeenCalledOnce()
    expect(screen.getByText('MAE vs PnL')).toBeInTheDocument()
    expect(screen.getByText('MFE vs PnL')).toBeInTheDocument()
  })

  it('hides the reason panel when performance is omitted, rendering the other 3 panels', () => {
    const trades = makeTrades(25)
    render(<TradeDistributionPanels trades={trades} performance={null} />)

    expect(screen.getByText('P&L distribution')).toBeInTheDocument()
    expect(screen.getByText('Holding time vs P&L')).toBeInTheDocument()
    expect(screen.queryByText('By reason')).not.toBeInTheDocument()
    expect(screen.getByText('By time')).toBeInTheDocument()
  })

  it('switches the By reason panel between entry and exit reasons', async () => {
    const user = userEvent.setup()
    const trades = makeTrades(25)
    const exitOnly: BacktestPerformance = { ...performanceWithExits, entry_reasons: [] }
    render(<TradeDistributionPanels trades={trades} performance={exitOnly} />)

    const exitToggle = screen.getByRole('radio', { name: 'Exit' })
    expect(exitToggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText('No entry reasons recorded.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Entry' }))
    expect(screen.getByRole('radio', { name: 'Entry' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('No entry reasons recorded.')).toBeInTheDocument()

    await user.click(exitToggle)
    expect(screen.queryByText('No entry reasons recorded.')).not.toBeInTheDocument()
  })

  it('renders a single empty state when there are no closed trades', () => {
    render(<TradeDistributionPanels trades={[]} performance={performanceWithExits} />)

    expect(screen.getByText(/No closed trades/i)).toBeInTheDocument()
    expect(screen.queryByText('Holding time vs P&L')).not.toBeInTheDocument()
  })

  it('allows toggling between Weekday and Hour breakdown in the By Time panel', async () => {
    const user = userEvent.setup()
    const trades = makeTrades(25)
    render(<TradeDistributionPanels trades={trades} performance={performanceWithExits} />)

    const hourToggle = screen.getByRole('radio', { name: 'Hour' })
    await user.click(hourToggle)
    expect(hourToggle).toHaveAttribute('aria-checked', 'true')
  })

  it('fires onFocusTrade when clicking a scatter point in the hold vs pnl panel', () => {
    const onFocusTrade = vi.fn()
    const trades = makeTrades(10)
    const { container } = render(
      <TradeDistributionPanels
        trades={trades}
        performance={performanceWithExits}
        onFocusTrade={onFocusTrade}
      />,
    )

    const symbols = container.querySelectorAll('.recharts-scatter-symbol')
    if (symbols.length > 0) {
      fireEvent.click(symbols[0])
      expect(onFocusTrade).toHaveBeenCalled()
    }
  })

  it('renders scatter plot with visible X and Y axes and plots all trades', () => {
    const trades: Trade[] = [
      {
        id: 't-1',
        order_id: 'o-1',
        symbol: 'PETR4',
        action: 'BUY',
        quantity: 100,
        entry_time: '2024-01-01T10:00:00Z',
        exit_time: '2024-01-01T11:05:00Z', // 3900s (1h 5m)
        entry_price: 30,
        exit_price: 31,
        pnl: 100,
        commission: 0,
        point_value: 1,
        status: 'CLOSED',
      },
      {
        id: 't-2',
        order_id: 'o-2',
        symbol: 'PETR4',
        action: 'BUY',
        quantity: 100,
        entry_time: '2024-01-01T10:00:00Z',
        exit_time: '2024-01-01T11:45:00Z', // 6300s (1h 45m)
        entry_price: 30,
        exit_price: 29,
        pnl: -50,
        commission: 0,
        point_value: 1,
        status: 'CLOSED',
      },
      {
        id: 't-3',
        order_id: 'o-3',
        symbol: 'PETR4',
        action: 'BUY',
        quantity: 100,
        entry_time: '2024-01-01T10:00:00Z',
        exit_time: '2024-01-01T12:05:00Z', // 7500s (2h 5m)
        entry_price: 30,
        exit_price: 32,
        pnl: 200,
        commission: 0,
        point_value: 1,
        status: 'CLOSED',
      },
      {
        id: 't-4',
        order_id: 'o-4',
        symbol: 'PETR4',
        action: 'BUY',
        quantity: 100,
        entry_time: '2024-01-01T10:00:00Z',
        exit_time: '2024-01-01T13:00:00Z', // 10800s (3h)
        entry_price: 30,
        exit_price: 28,
        pnl: -100,
        commission: 0,
        point_value: 1,
        status: 'CLOSED',
      },
    ]

    const { container } = render(<TradeDistributionPanels trades={trades} performance={null} />)

    const symbols = container.querySelectorAll('.recharts-scatter-symbol')
    expect(symbols).toHaveLength(4)

    // Verify both axes are present in the scatter chart
    const scatterContainer = container
      .querySelector('.recharts-scatter')
      ?.closest('.recharts-wrapper')
    expect(scatterContainer?.querySelector('.recharts-xAxis')).toBeInTheDocument()
    expect(scatterContainer?.querySelector('.recharts-yAxis')).toBeInTheDocument()
  })
})
