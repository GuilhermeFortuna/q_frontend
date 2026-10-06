import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BacktestStrategyChart } from '@/components/backtests/BacktestStrategyChart'
import { getMockBacktestResponse } from '@/mocks/backtest'
import type { BacktestRequest } from '@/types/backtesting'

vi.mock('@visx/responsive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@visx/responsive')>()
  return {
    ...actual,
    useParentSize: () => ({
      parentRef: { current: null },
      width: 960,
      height: 420,
      top: 0,
      left: 0,
      resize: () => {},
    }),
  }
})

const mockRequest: BacktestRequest = {
  symbol: 'COMS',
  timeframe: 'H1',
  initial_capital: 5000,
  strategy: 'MACrossover',
}

describe('BacktestStrategyChart', () => {
  it('renders candlesticks when bars are present', () => {
    const response = getMockBacktestResponse(mockRequest)

    render(
      <BacktestStrategyChart
        bars={response.bars}
        indicators={response.indicators}
        trades={response.trades}
        symbol={mockRequest.symbol}
        timeframe={mockRequest.timeframe}
      />,
    )

    expect(screen.getByText('COMS · H1')).toBeInTheDocument()
    expect(document.querySelector('svg')).not.toBeNull()
  })

  it('filters trade overlays by closed-trade P&L outcome', async () => {
    const response = getMockBacktestResponse(mockRequest)
    const tradePnls = [100, -50, 0, null, 25]
    const trades = response.trades.slice(0, 5).map((trade, index) => ({
      ...trade,
      pnl: tradePnls[index],
      status: index === 4 ? ('OPEN' as const) : ('CLOSED' as const),
      ...(index === 4 ? { exit_time: null, exit_price: null } : {}),
    }))

    render(
      <BacktestStrategyChart
        bars={response.bars}
        indicators={response.indicators}
        trades={trades}
        symbol={mockRequest.symbol}
        timeframe={mockRequest.timeframe}
      />,
    )

    const countCompleteTradePaths = () =>
      document.querySelectorAll('line[stroke="transparent"]').length
    const countEntryMarkers = () => document.querySelectorAll('svg polygon').length

    expect(countCompleteTradePaths()).toBe(4)
    expect(countEntryMarkers()).toBe(5)
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Winners' }))
    expect(countCompleteTradePaths()).toBe(1)
    expect(countEntryMarkers()).toBe(1)
    expect(screen.getByRole('button', { name: 'Winners' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Losers' }))
    expect(countCompleteTradePaths()).toBe(1)
    expect(countEntryMarkers()).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(countCompleteTradePaths()).toBe(4)
    expect(countEntryMarkers()).toBe(5)
  })

  it('renders backend exit rule ids as compact marker labels', () => {
    const response = getMockBacktestResponse(mockRequest)
    response.trades[0] = {
      ...response.trades[0],
      exit_reason: 'donchian_stop',
    }

    render(
      <BacktestStrategyChart
        bars={response.bars}
        indicators={response.indicators}
        trades={response.trades}
        symbol={mockRequest.symbol}
        timeframe={mockRequest.timeframe}
      />,
    )

    expect(screen.getByText('DC')).toBeInTheDocument()
  })

  it('shows an empty state when bars are missing', () => {
    render(
      <BacktestStrategyChart bars={[]} indicators={[]} trades={[]} symbol="COMS" timeframe="H1" />,
    )

    expect(screen.getByText('No price data available for this backtest.')).toBeInTheDocument()
  })

  it('renders popout button and triggers window opening', () => {
    const response = getMockBacktestResponse(mockRequest)
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(
      <BacktestStrategyChart
        bars={response.bars}
        indicators={response.indicators}
        trades={response.trades}
        symbol={mockRequest.symbol}
        timeframe={mockRequest.timeframe}
        runId="mock-run-id"
      />,
    )

    const popoutBtn = screen.getByTitle('Open in Standalone Window')
    expect(popoutBtn).toBeInTheDocument()

    popoutBtn.click()

    expect(openSpy).toHaveBeenCalled()
    openSpy.mockRestore()
  })
})
