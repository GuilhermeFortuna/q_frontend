import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest'
import { createRef, type ComponentProps } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'

import { CandlestickChart, type CandlestickChartHandle } from '@/components/charts/CandlestickChart'
import type { OhlcvBar } from '@/types/api'
import type { IndicatorConfig } from '@/components/charts/types/chart'
import { handlers } from '@/mocks/handlers'
import { normalizeIndicatorConfigs } from '@/lib/market/indicatorConfig'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

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

const smaIndicators: IndicatorConfig[] = [{ id: 'sma', enabled: true, parameters: { period: 5 } }]

function renderChart(props: Partial<ComponentProps<typeof CandlestickChart>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }

  return render(
    <div style={{ width: 800, height: 400 }}>
      <CandlestickChart
        data={mockBars}
        symbol="PETR4"
        timeframe="1D"
        indicators={smaIndicators}
        {...props}
      />
    </div>,
    { wrapper: Wrapper },
  )
}

async function waitForChartSvg() {
  await waitFor(() => expect(document.querySelector('svg')).toBeTruthy())
}

describe('CandlestickChart', () => {
  it('renders empty state when no data', () => {
    renderChart({ data: [] })
    expect(screen.getByText('No chart data available.')).toBeInTheDocument()
  })

  it('renders chart with mock OHLCV data', async () => {
    const { container } = renderChart()
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

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children)
    }

    render(
      <div style={{ width: 800, height: 400 }}>
        <CandlestickChart ref={chartRef} data={manyBars} symbol="PETR4" timeframe="1D" />
      </div>,
      { wrapper: Wrapper },
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

  it('draws backend SMA overlay from the indicator series endpoint', async () => {
    renderChart()
    await waitForChartSvg()
    await waitFor(() => {
      expect(document.querySelector('[data-testid="market-indicator-line-sma"]')).toBeTruthy()
    })
  })

  it('renders an oscillator pane for ATR fraction from the endpoint', async () => {
    renderChart({
      indicators: [{ id: 'atr_fraction', enabled: true, parameters: { period: 14 } }],
    })
    await waitForChartSvg()
    await waitFor(() => {
      expect(document.querySelector('[data-testid="market-oscillator-atr_fraction"]')).toBeTruthy()
    })
  })

  it('shows unavailable reason for quote spread when ticks are missing', async () => {
    renderChart({
      indicators: [{ id: 'quote_spread', enabled: true, parameters: {} }],
    })
    await waitForChartSvg()
    await waitFor(() => {
      expect(screen.getByText(/No tick history for this range/i)).toBeInTheDocument()
    })
  })

  it('shows why indicators are missing when the series request is rejected', async () => {
    server.use(
      http.post('*/api/v1/market/indicators/:symbol/series', () =>
        HttpResponse.json(
          { detail: "Indicator 'sma': Parameter 'period' must be <= 5000 (got 9000)." },
          { status: 422 },
        ),
      ),
    )
    renderChart({ indicators: [{ id: 'sma', enabled: true, parameters: { period: 9000 } }] })
    await waitForChartSvg()
    await waitFor(() => {
      expect(screen.getByTestId('market-indicator-notice')).toHaveTextContent(
        "Parameter 'period' must be <= 5000",
      )
    })
    expect(document.querySelector('[data-testid="market-indicator-line-sma"]')).toBeNull()
  })

  it('draws the known indicators and names one the catalog does not list', async () => {
    renderChart({
      indicators: [...smaIndicators, { id: 'retired_indicator', enabled: true, parameters: {} }],
    })
    await waitForChartSvg()
    await waitFor(() => {
      expect(document.querySelector('[data-testid="market-indicator-line-sma"]')).toBeTruthy()
    })
    expect(screen.getByTestId('market-indicator-notice')).toHaveTextContent('retired_indicator')
  })

  it('still renders migrated legacy SMA, Bollinger and RSI selections', async () => {
    const legacy = normalizeIndicatorConfigs([
      { type: 'sma', enabled: true, period: 5 },
      { type: 'bollinger', enabled: true, period: 10, stdDev: 2 },
      { type: 'rsi', enabled: true, period: 14 },
    ])

    renderChart({ indicators: legacy })
    await waitForChartSvg()

    await waitFor(() => {
      expect(document.querySelector('[data-testid="market-indicator-line-sma"]')).toBeTruthy()
      expect(
        document.querySelector('[data-testid="market-indicator-bands-bollinger"]'),
      ).toBeTruthy()
      expect(document.querySelector('[data-testid="market-oscillator-rsi"]')).toBeTruthy()
    })
  })
})
