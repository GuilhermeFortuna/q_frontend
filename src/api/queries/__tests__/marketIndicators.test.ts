import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  fetchIndicatorCatalog,
  fetchMarketIndicatorSeries,
  marketIndicatorKeys,
  useIndicatorCatalog,
} from '@/api/queries/marketIndicators'
import { getMockOhlcv } from '@/mocks/data'
import { handlers } from '@/mocks/handlers'
import { mockIndicatorCatalog } from '@/mocks/marketIndicators'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('marketIndicators API', () => {
  it('fetchIndicatorCatalog returns every catalog entry from MSW', async () => {
    const catalog = await fetchIndicatorCatalog()
    expect(catalog.indicators).toHaveLength(mockIndicatorCatalog.indicators.length)
    expect(catalog.indicators.some((entry) => entry.id === 'atr_fraction')).toBe(true)
  })

  it('fetchMarketIndicatorSeries returns aligned timestamps and series outputs', async () => {
    const bars = getMockOhlcv('PETR4', 'D1', 40)

    const start = bars[0].timestamp
    const end = bars[bars.length - 1].timestamp

    const payload = await fetchMarketIndicatorSeries('PETR4', {
      timeframe: 'D1',
      start,
      end,
      indicators: [{ id: 'atr_fraction', parameters: { period: 14 } }],
    })

    expect(payload.timestamps).toHaveLength(bars.length)
    expect(payload.series[0]?.pane).toBe('oscillator')
    expect(payload.series[0]?.values).toHaveLength(bars.length)
  })

  it('marketIndicatorKeys.catalog is stable', () => {
    expect(marketIndicatorKeys.catalog()).toEqual(['market-indicators', 'catalog'])
  })

  it('useIndicatorCatalog resolves through MSW', async () => {
    const { result } = renderHook(() => useIndicatorCatalog(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.indicators.length).toBe(mockIndicatorCatalog.indicators.length)
  })
})
