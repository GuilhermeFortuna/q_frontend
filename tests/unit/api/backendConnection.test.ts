import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SystemHealthResponse } from '../../../contracts/api'
import { useBackendConnection } from '@/api/queries/backendConnection'

const envState = vi.hoisted(() => ({
  apiBaseUrl: 'http://127.0.0.1:8000',
  enableMsw: false,
  enableStream: true,
  isDev: false,
  perfHud: false,
  sentryDsn: '',
  sentryEnvironment: 'local',
  sentryTracesSampleRate: 0.2,
  sentryRelease: '',
}))

vi.mock('@/lib/env', () => ({ env: envState }))

const healthyResponse: SystemHealthResponse = {
  active_provider: 'mt5',
  backendVersion: '0.1.0',
  dataLakeStatus: 'healthy',
  lastSyncAt: '2026-09-14T10:00:00Z',
  market_data_inventory_count: 5,
  market_data_root: '/data',
  mt5_available: true,
  status: 'ok',
  storageStatus: {
    postgres: { status: 'ok', error: null },
    redis: { status: 'ok', error: null },
  },
}

describe('useBackendConnection', () => {
  const server = setupServer()

  beforeEach(() => {
    envState.enableMsw = false
    envState.apiBaseUrl = 'http://127.0.0.1:8000'
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterEach(() => {
    server.close()
    server.resetHandlers()
    vi.useRealTimers()
  })

  it('backs off exponentially over 7 failures (1, 2, 4, 8, 16, 30, 30 s), recovers to connected without remount, and refetches failed sibling query exactly once', async () => {
    let healthAttempts = 0
    let shouldFail = true
    const intervals: number[] = []

    server.use(
      http.get('*/api/v1/system/health', () => {
        healthAttempts += 1
        if (shouldFail) {
          return HttpResponse.error()
        }
        return HttpResponse.json(healthyResponse)
      }),
    )

    let siblingAttempts = 0
    server.use(
      http.get('*/api/v1/test-sibling', () => {
        siblingAttempts += 1
        if (shouldFail) {
          return HttpResponse.error()
        }
        return HttpResponse.json({ data: 'ok' })
      }),
    )

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })

    // Render hook alongside a sibling query
    const { result } = renderHook(
      () => {
        const connection = useBackendConnection()
        const sibling = useQuery({
          queryKey: ['test-sibling'],
          queryFn: async () => {
            const res = await fetch('http://127.0.0.1:8000/api/v1/test-sibling')
            if (!res.ok) throw new Error('sibling failed')
            return res.json()
          },
        })
        return { connection, sibling }
      },
      { wrapper },
    )

    // Let the initial fetch resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
    })

    expect(healthAttempts).toBe(1)
    expect(result.current.connection.state).toBe('offline')
    if (result.current.connection.state === 'offline') {
      expect(result.current.connection.apiBaseUrl).toBe('http://127.0.0.1:8000')
      expect(result.current.connection.nextRetryMs).toBe(1000)
    }

    expect(siblingAttempts).toBe(1)
    expect(result.current.sibling.isError).toBe(true)

    const expectedDelaysSeconds = [1, 2, 4, 8, 16, 30, 30]

    for (let i = 0; i < expectedDelaysSeconds.length; i += 1) {
      const delaySec = expectedDelaysSeconds[i]
      const prevAttempts = healthAttempts

      // Advance by slightly less than the expected delay: no new attempt
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delaySec * 1000 - 10)
      })
      expect(healthAttempts).toBe(prevAttempts)

      // Complete the interval: new attempt fires
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })
      expect(healthAttempts).toBe(prevAttempts + 1)
      intervals.push(delaySec)
    }

    expect(intervals).toEqual([1, 2, 4, 8, 16, 30, 30])
    expect(result.current.connection.state).toBe('offline')

    // Now make the backend healthy
    shouldFail = false

    // Next tick (30s) fires recovery request
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(healthAttempts).toBe(9) // 1 initial + 7 retries + 1 recovery
    expect(result.current.connection.state).toBe('connected')
    if (result.current.connection.state === 'connected') {
      expect(result.current.connection.health.status).toBe('ok')
    }

    // Sibling query was refetched exactly once on recovery
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(siblingAttempts).toBe(2)
    expect(result.current.sibling.isSuccess).toBe(true)

    // Advance further: sibling is NOT refetched again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(siblingAttempts).toBe(2)
  })

  it('in mock mode, state is mocked and no health request is recorded', async () => {
    envState.enableMsw = true
    let healthRequests = 0

    server.use(
      http.get('*/api/v1/system/health', () => {
        healthRequests += 1
        return HttpResponse.json(healthyResponse)
      }),
    )

    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useBackendConnection(), { wrapper })

    expect(result.current).toEqual({ state: 'mocked' })
    expect(healthRequests).toBe(0)
    expect(queryClient.getQueryCache().findAll()).toHaveLength(0)
  })
})
