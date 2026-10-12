import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse, delay } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { IndicatorPreview } from '@/components/charts/IndicatorPreview'
import { getMockOhlcv } from '@/mocks/data'
import { mockIndicatorCatalog } from '@/mocks/marketIndicators'
import type { MarketIndicatorSeriesRequest } from '../../../contracts/api'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => server.close())
const entry = mockIndicatorCatalog.indicators.find((e) => e.id === 'sma')!
const bars = getMockOhlcv('PETR4', 'D1', 180)
const context = { symbol: 'PETR4', timeframe: 'D1', bars }
const config = { id: 'sma', enabled: false, parameters: { period: 20 } }
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}
function reply(value: number, unavailableReason: string | null = null) {
  return HttpResponse.json({
    timestamps: bars.map((b) => b.timestamp),
    series: [
      {
        key: 'line',
        pane: 'price',
        values: bars.map(() => (unavailableReason ? null : value)),
        unavailableReason,
      },
    ],
  })
}

describe('IndicatorPreview', () => {
  it('explains missing chart context without a request', () => {
    render(<IndicatorPreview entry={entry} config={config} />, { wrapper: wrapper() })
    expect(screen.getByText('Load chart data to see a preview.')).toBeInTheDocument()
  })
  it('previews a disabled draft, uses the loaded range, and changes style without refetching', async () => {
    const requests: MarketIndicatorSeriesRequest[] = []
    server.use(
      http.post('*/api/v1/market/indicators/PETR4/series', async ({ request }) => {
        requests.push((await request.json()) as MarketIndicatorSeriesRequest)
        return reply(42)
      }),
    )
    const view = render(<IndicatorPreview entry={entry} config={config} context={context} />, {
      wrapper: wrapper(),
    })
    expect(await screen.findByRole('img', { name: /SMA preview/ })).toBeInTheDocument()
    expect(requests[0]).toEqual({
      timeframe: 'D1',
      start: bars[0].timestamp,
      end: bars.at(-1)!.timestamp,
      indicators: [{ id: 'sma', parameters: { period: 20 } }],
    })
    view.rerender(
      <IndicatorPreview
        entry={entry}
        config={{ ...config, style: { color: '#ef5350' } }}
        context={context}
      />,
    )
    expect(requests).toHaveLength(1)
    expect(screen.getByText('42')).toBeInTheDocument()
  })
  it('debounces edits and never labels an old result as the new configuration', async () => {
    const requests: number[] = []
    server.use(
      http.post('*/api/v1/market/indicators/PETR4/series', async ({ request }) => {
        const body = (await request.json()) as MarketIndicatorSeriesRequest
        const period = body.indicators[0].parameters!.period as number
        requests.push(period)
        if (period === 35) await delay(80)
        return reply(period)
      }),
    )
    const view = render(<IndicatorPreview entry={entry} config={config} context={context} />, {
      wrapper: wrapper(),
    })
    await screen.findByRole('img')
    view.rerender(
      <IndicatorPreview
        entry={entry}
        config={{ ...config, parameters: { period: 30 } }}
        context={context}
      />,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    view.rerender(
      <IndicatorPreview
        entry={entry}
        config={{ ...config, parameters: { period: 35 } }}
        context={context}
      />,
    )
    await waitFor(() => expect(screen.getByText('35')).toBeInTheDocument())
    expect(requests).toEqual([20, 35])
  })
  it('shows an unavailable reason and recovers from errors through retry', async () => {
    server.use(
      http.post('*/api/v1/market/indicators/PETR4/series', () =>
        HttpResponse.json({ detail: 'Data service unavailable' }, { status: 503 }),
      ),
    )
    render(<IndicatorPreview entry={entry} config={config} context={context} />, {
      wrapper: wrapper(),
    })
    expect(await screen.findByText('Data service unavailable')).toBeInTheDocument()
    server.use(
      http.post('*/api/v1/market/indicators/PETR4/series', () => reply(0, 'No quote coverage')),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }))
    expect(await screen.findByText('No quote coverage')).toBeInTheDocument()
  })
  it('explains insufficient history for an all-null series', async () => {
    server.use(
      http.post('*/api/v1/market/indicators/PETR4/series', () =>
        HttpResponse.json({
          timestamps: bars.map((b) => b.timestamp),
          series: [{ key: 'line', pane: 'price', values: bars.map(() => null) }],
        }),
      ),
    )
    render(<IndicatorPreview entry={entry} config={config} context={context} />, {
      wrapper: wrapper(),
    })
    expect(
      await screen.findByText(
        'No values in this range. Load more history or shorten the lookback.',
      ),
    ).toBeInTheDocument()
  })

  it('cancels a superseded context and keeps the new symbol and timeframe result', async () => {
    let started = false
    const post = vi.spyOn(apiClient, 'post')
    server.use(
      http.post('*/api/v1/market/indicators/PETR4/series', async () => {
        started = true
        await delay(600)
        return reply(42)
      }),
      http.post('*/api/v1/market/indicators/VALE3/series', () => reply(77)),
    )
    const view = render(<IndicatorPreview entry={entry} config={config} context={context} />, {
      wrapper: wrapper(),
    })
    await waitFor(() => expect(started).toBe(true))
    view.rerender(
      <IndicatorPreview
        entry={entry}
        config={config}
        context={{ ...context, symbol: 'VALE3', timeframe: '1H' }}
      />,
    )
    expect(await screen.findByText('77', { selector: 'span' })).toBeInTheDocument()
    expect(post.mock.calls[0][2]?.signal?.aborted).toBe(true)
    expect(screen.getByText(/VALE3 · 1H/)).toBeInTheDocument()
    expect(screen.queryByText('42')).not.toBeInTheDocument()
  })

  it('renders MACD lines, signal, and histogram with distinct output colors', async () => {
    const macd = mockIndicatorCatalog.indicators.find((e) => e.id === 'macd')!
    server.use(
      http.post('*/api/v1/market/indicators/PETR4/series', () =>
        HttpResponse.json({
          timestamps: bars.map((b) => b.timestamp),
          series: ['line', 'signal', 'histogram'].map((key, index) => ({
            key,
            pane: 'oscillator',
            values: bars.map((_, i) => (i % 5) - index - 2),
          })),
        }),
      ),
    )
    render(
      <IndicatorPreview
        entry={macd}
        config={{
          id: 'macd',
          enabled: false,
          parameters: { fast_period: 12, slow_period: 26, signal_period: 9 },
        }}
        context={context}
      />,
      { wrapper: wrapper() },
    )
    await screen.findByRole('img')
    expect(screen.getByTestId('preview-output-line').getAttribute('stroke')).not.toBe(
      screen.getByTestId('preview-output-signal').getAttribute('stroke'),
    )
    expect(screen.getByText('Histogram')).toBeInTheDocument()
    expect(screen.getByRole('img').querySelectorAll('rect').length).toBeGreaterThan(160)
    fireEvent.keyDown(screen.getByRole('img'), { key: 'Home' })
    expect(screen.queryByText('Latest')).not.toBeInTheDocument()
  })

  it('renders a band fill and preserves missing-value gaps in its lines', async () => {
    const bollinger = mockIndicatorCatalog.indicators.find((e) => e.id === 'bollinger')!
    server.use(
      http.post('*/api/v1/market/indicators/PETR4/series', () =>
        HttpResponse.json({
          timestamps: bars.map((b) => b.timestamp),
          series: ['upper', 'middle', 'lower'].map((key, index) => ({
            key,
            pane: 'price',
            values: bars.map((_, i) => (i === 50 ? null : 40 - index)),
          })),
        }),
      ),
    )
    render(
      <IndicatorPreview
        entry={bollinger}
        config={{ id: 'bollinger', enabled: false, parameters: { period: 20, num_std: 2 } }}
        context={context}
      />,
      { wrapper: wrapper() },
    )
    await screen.findByRole('img')
    const path = screen.getByTestId('preview-output-upper').getAttribute('d')!
    expect(path.match(/M/g)).toHaveLength(2)
    expect(
      screen.getByRole('img').querySelector('path[fill-opacity="0.1"]')?.getAttribute('d'),
    ).toBeTruthy()
    expect(screen.getByText('Middle')).toBeInTheDocument()
    expect(screen.getByText('Lower')).toBeInTheDocument()
  })

  it('does not request invalid configurations', () => {
    render(<IndicatorPreview entry={entry} config={config} context={context} invalid />, {
      wrapper: wrapper(),
    })
    expect(
      screen.getByText('Correct the parameter settings to update the preview.'),
    ).toBeInTheDocument()
  })

  it('does not draw unaligned series values outside the loaded chart range', async () => {
    server.use(
      http.post('*/api/v1/market/indicators/PETR4/series', () =>
        HttpResponse.json({
          timestamps: ['2000-01-01T00:00:00Z'],
          series: [{ key: 'line', pane: 'price', values: [42] }],
        }),
      ),
    )
    render(<IndicatorPreview entry={entry} config={config} context={context} />, {
      wrapper: wrapper(),
    })
    expect(
      await screen.findByText(
        'No values in this range. Load more history or shorten the lookback.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
