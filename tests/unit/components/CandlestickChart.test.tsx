import { describe, expect, it } from 'vitest'
import { createRef } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CandlestickChart, type CandlestickChartHandle } from '@/components/charts/CandlestickChart'
import type { OhlcvBar } from '@/types/api'

const mockBars: OhlcvBar[] = Array.from({ length: 30 }, (_, i) => {
  const close = 100 + i * 0.5
  return {
    timestamp: new Date(Date.UTC(2024, 5, i + 1)).toISOString(),
    open: close - 0.3,
    high: close + 0.8,
    low: close - 0.8,
    close,
    volume: 1_000_000 + i * 10_000,
  }
})

describe('CandlestickChart', () => {
  it('renders empty state when no data', () => {
    render(<CandlestickChart data={[]} symbol="PETR4" />)
    expect(screen.getByText('No chart data available.')).toBeInTheDocument()
  })

  it('renders chart with mock OHLCV data', async () => {
    const { container } = render(
      <div style={{ width: 800, height: 400 }}>
        <CandlestickChart data={mockBars} symbol="PETR4" timeframe="1D" />
      </div>,
    )
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
    expect(screen.queryByLabelText('Go to latest candle')).not.toBeInTheDocument()
  })

  it('shows latest button when scrolled away from the end and jumps back on click', async () => {
    const user = userEvent.setup()
    const chartRef = createRef<CandlestickChartHandle>()
    const manyBars: OhlcvBar[] = Array.from({ length: 150 }, (_, i) => {
      const close = 100 + i * 0.5
      return {
        timestamp: new Date(Date.UTC(2024, 0, i + 1)).toISOString(),
        open: close - 0.3,
        high: close + 0.8,
        low: close - 0.8,
        close,
        volume: 1_000_000 + i * 10_000,
      }
    })

    render(
      <div style={{ width: 800, height: 400 }}>
        <CandlestickChart ref={chartRef} data={manyBars} symbol="PETR4" timeframe="1D" />
      </div>,
    )

    await waitFor(() => expect(chartRef.current).not.toBeNull())
    await waitFor(() => expect(document.querySelector('svg')).toBeTruthy())

    act(() => {
      chartRef.current!.panBy(-50)
    })

    const latestButton = await screen.findByLabelText('Go to latest candle')
    expect(latestButton).toBeInTheDocument()

    await user.click(latestButton)

    expect(screen.queryByLabelText('Go to latest candle')).not.toBeInTheDocument()
  })
})
