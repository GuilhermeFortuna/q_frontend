import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChartPanel, type ChartPanelProps } from '@/components/market/ChartPanel'
import type { OhlcvBar } from '@/types/api'

vi.mock('@/components/charts/CandlestickChart', () => ({
  CandlestickChart: () => <div data-testid="candlestick-chart" />,
}))

vi.mock('@/components/status/FaultyTerminalField', () => ({
  FaultyTerminalField: () => (
    <div data-testid="faulty-terminal-field" aria-hidden="true" />
  ),
}))

const sampleBar: OhlcvBar = {
  timestamp: '2024-01-02T12:00:00Z',
  open: 10,
  high: 11,
  low: 9,
  close: 10.5,
  volume: 1000,
}

function baseProps(overrides: Partial<ChartPanelProps> = {}): ChartPanelProps {
  return {
    symbol: 'PETR4',
    timeframe: '1D',
    chartType: 'candles',
    indicators: [],
    showGrid: true,
    activeDrawingTool: 'cursor',
    drawings: [],
    onDrawingsChange: vi.fn(),
    bars: [],
    isInitialLoading: false,
    isBackfilling: false,
    isProbingRange: false,
    error: null,
    tickTime: null,
    chartRef: createRef(),
    onHoverBar: vi.fn(),
    onViewportChange: vi.fn(),
    ...overrides,
  }
}

describe('ChartPanel state policy (WO219)', () => {
  it('shows loading UI while initial load is in progress', () => {
    render(<ChartPanel {...baseProps({ isInitialLoading: true, error: new Error('boom') })} />)
    expect(screen.getByText('Loading market candles…')).toBeInTheDocument()
    expect(screen.queryByTestId('chart-panel-operational-failure')).not.toBeInTheDocument()
    expect(screen.queryByTestId('faulty-terminal-field')).not.toBeInTheDocument()
  })

  it('keeps the chart when bars exist even if error is set', () => {
    render(
      <ChartPanel
        {...baseProps({
          bars: [sampleBar],
          error: new Error('stale refresh failed'),
        })}
      />,
    )
    expect(screen.getByTestId('candlestick-chart')).toBeInTheDocument()
    expect(screen.queryByTestId('chart-panel-operational-failure')).not.toBeInTheDocument()
    expect(screen.queryByTestId('faulty-terminal-field')).not.toBeInTheDocument()
  })

  it('shows OperationalFailureState only for empty bars with an error', () => {
    render(
      <ChartPanel
        {...baseProps({
          bars: [],
          error: new Error('history fetch failed'),
        })}
      />,
    )
    expect(screen.getByTestId('chart-panel-operational-failure')).toBeInTheDocument()
    expect(screen.getByText('Market data unavailable')).toBeInTheDocument()
    expect(screen.getByTestId('faulty-terminal-field')).toBeInTheDocument()
    expect(screen.queryByTestId('candlestick-chart')).not.toBeInTheDocument()
  })

  it('shows neutral empty copy when there is no error and no bars', () => {
    render(<ChartPanel {...baseProps({ bars: [], error: null })} />)
    expect(screen.getByTestId('chart-panel-empty')).toHaveTextContent(
      'No market data for PETR4 in this range.',
    )
    expect(screen.queryByTestId('chart-panel-operational-failure')).not.toBeInTheDocument()
    expect(screen.queryByTestId('faulty-terminal-field')).not.toBeInTheDocument()
  })
})
