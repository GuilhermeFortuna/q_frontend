import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CandlestickChart } from '@/components/charts/CandlestickChart'
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
    expect(await screen.findByLabelText('Reset chart view')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
