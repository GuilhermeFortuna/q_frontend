import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { createRef, type ComponentProps } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('shows profile row values through the chart interaction overlay', async () => {
    const anchor = mockBars[mockBars.length - 1].close
    server.use(
      http.post('*/api/v1/market/volume-profile/:symbol', () =>
        HttpResponse.json({
          tickSize: 0.5,
          rowSize: 0.5,
          unavailableReason: null,
          segments: [
            {
              start: mockBars[0].timestamp,
              end: mockBars[mockBars.length - 1].timestamp,
              total: 900,
              buy: 500,
              sell: 350,
              unknown: 50,
              trades: 10,
              poc: anchor,
              vah: anchor + 0.5,
              val: anchor - 0.5,
              rows: {
                price: [anchor - 0.5, anchor, anchor + 0.5],
                buy: [40, 200, 30],
                sell: [30, 50, 80],
                unknown: [5, 5, 0],
              },
            },
          ],
        }),
      ),
    )
    renderChart({
      indicators: [
        {
          id: 'volume_profile',
          enabled: true,
          parameters: {
            segment: 'session',
            rowTicks: 1,
            valueArea: 0.7,
            splitBuySell: true,
            widthPercent: 25,
          },
        },
      ],
    })
    await waitForChartSvg()
    await waitFor(() =>
      expect(document.querySelector('[data-testid="volume-profile-layer"]')).toBeTruthy(),
    )
    const row = document.querySelector('[data-testid="volume-profile-poc-row"]')!
    const interaction = screen.getByTestId('chart-interaction')
    fireEvent.mouseMove(interaction, {
      clientX: Number(row.getAttribute('x')) + 1,
      clientY: Number(row.getAttribute('y')) + Number(row.getAttribute('height')) / 2,
    })
    await waitFor(() =>
      expect(screen.getByTestId('volume-profile-tooltip')).toHaveTextContent('255'),
    )
    fireEvent.mouseLeave(interaction)
    await waitFor(() =>
      expect(screen.queryByTestId('volume-profile-tooltip')).not.toBeInTheDocument(),
    )
  })

  it.each(['session', 'visibleRange'])(
    'requests the full final candle for %s profiles',
    async (segment) => {
      let received: { start: string; end: string } | undefined
      server.use(
        http.post('*/api/v1/market/volume-profile/:symbol', async ({ request }) => {
          received = (await request.json()) as { start: string; end: string }
          return HttpResponse.json({ segments: [], unavailableReason: null })
        }),
      )
      renderChart({
        data: [mockBars[0]],
        timeframe: '5m',
        indicators: [
          {
            id: 'volume_profile',
            enabled: true,
            parameters: { segment },
          },
        ],
      })
      await waitFor(() => expect(received).toBeDefined())
      expect(received?.start).toBe('2024-06-01T00:00:00.000Z')
      expect(received?.end).toBe('2024-06-01T00:05:00.000Z')
    },
  )

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

describe('oscillator pane layout', () => {
  const atrIndicators: IndicatorConfig[] = [
    { id: 'atr_fraction', enabled: true, parameters: { period: 14 } },
  ]

  async function waitForOscillatorPane() {
    await screen.findByTestId('market-oscillator-atr_fraction', undefined, { timeout: 5000 })
  }

  // Pane keys include the indicator parameters, so match the id by prefix.
  function paneHandle(prefix: string) {
    const element = document.querySelector(`[data-testid^="${prefix}"]`)
    if (!element) throw new Error(`No pane handle ${prefix}`)
    return element as HTMLElement
  }

  it('commits a larger height when the oscillator top edge is dragged up', async () => {
    const onPaneLayoutChange = vi.fn()
    renderChart({ indicators: atrIndicators, onPaneLayoutChange })
    await waitForChartSvg()
    await waitForOscillatorPane()

    const strip = paneHandle('pane-resize-atr_fraction')
    fireEvent.mouseDown(strip, { button: 0, clientY: 100 })
    fireEvent.mouseMove(window, { clientY: 80 })
    fireEvent.mouseUp(window)

    expect(onPaneLayoutChange).toHaveBeenCalledTimes(1)
    const prefs = onPaneLayoutChange.mock.calls[0][0]
    // Dragging up grows the oscillator and takes the space from volume above it.
    const heights = prefs.heights as Record<string, number>
    const oscillatorKey = Object.keys(heights).find((key) => key.startsWith('atr_fraction'))!
    expect(heights[oscillatorKey]).toBeGreaterThan(0.14)
    expect(heights.volume).toBeLessThan(0.18)
  })

  it('moves an oscillator above the price pane on Ctrl+drag', async () => {
    const onPaneLayoutChange = vi.fn()
    renderChart({ indicators: atrIndicators, onPaneLayoutChange })
    await waitForChartSvg()
    await waitForOscillatorPane()

    const body = paneHandle('pane-move-atr_fraction')
    fireEvent.mouseDown(body, { button: 0, clientY: 300, ctrlKey: true })
    fireEvent.mouseMove(window, { clientY: 0 })
    fireEvent.mouseUp(window)

    expect(onPaneLayoutChange).toHaveBeenCalledTimes(1)
    const order: string[] = onPaneLayoutChange.mock.calls[0][0].order
    expect(order[0]).toMatch(/^atr_fraction/)
    expect(order.slice(1)).toEqual(['price', 'volume'])
  })

  it('does not move a pane without Ctrl', async () => {
    const onPaneLayoutChange = vi.fn()
    renderChart({ indicators: atrIndicators, onPaneLayoutChange })
    await waitForChartSvg()
    await waitForOscillatorPane()

    const body = paneHandle('pane-move-atr_fraction')
    fireEvent.mouseDown(body, { button: 0, clientY: 300 })
    fireEvent.mouseMove(window, { clientY: 0 })
    fireEvent.mouseUp(window)

    expect(onPaneLayoutChange).not.toHaveBeenCalled()
  })

  it('shows the hover readout when the cursor is over an oscillator pane', async () => {
    renderChart({
      indicators: atrIndicators,
    })
    await waitForChartSvg()
    await waitForOscillatorPane()

    fireEvent.mouseMove(screen.getByTestId('chart-interaction'), { clientX: 700, clientY: 350 })

    await waitFor(() => expect(screen.getByTestId('oscillator-hover')).toBeInTheDocument())
  })
})
