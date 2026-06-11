import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { fetchMarketSnapshots, marketDataKeys, useMarketSnapshots } from '@/api/queries/market-data'
import { handlers } from '@/mocks/handlers'

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

describe('market snapshots API', () => {
  it('fetchMarketSnapshots returns enriched snapshots for requested symbols', async () => {
    const result = await fetchMarketSnapshots(['PETR4', 'VALE3'])

    expect(result.snapshots).toHaveLength(2)
    expect(result.snapshots[0]).toMatchObject({
      symbol: expect.any(String),
      last: expect.any(Number),
      changePct: expect.any(Number),
      volume: expect.any(Number),
      bid: expect.any(Number),
      ask: expect.any(Number),
      spread: expect.any(Number),
      digits: expect.any(Number),
    })
  })

  it('marketDataKeys.snapshots sorts symbols for stable cache keys', () => {
    expect(marketDataKeys.snapshots(['VALE3', 'PETR4'])).toEqual(
      marketDataKeys.snapshots(['PETR4', 'VALE3']),
    )
  })

  it('useMarketSnapshots returns a record keyed by symbol', async () => {
    const { result } = renderHook(() => useMarketSnapshots(['PETR4', 'VALE3']), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.data?.PETR4).toBeDefined()
      expect(result.current.data?.VALE3).toBeDefined()
    })

    expect(result.current.data?.PETR4.symbol).toBe('PETR4')
    expect(result.current.data?.VALE3.symbol).toBe('VALE3')
  })

  it('useMarketSnapshots stays disabled for an empty symbol list', () => {
    const { result } = renderHook(() => useMarketSnapshots([]), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})
