import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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
