import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { fetchDeploymentChart, useDeploymentChart } from '@/api/queries/execution'
import { handlers } from '@/mocks/handlers'
import { resetMockExecutionState } from '@/mocks/execution'

const server = setupServer(...handlers)
const DEPLOYMENT_ID = '22222222-2222-2222-2222-222222222222'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetMockExecutionState())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    queryClient,
    Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children)
    },
  }
}

describe('useDeploymentChart', () => {
  it('fetchDeploymentChart returns the WO175 payload shape', async () => {
    const chart = await fetchDeploymentChart(DEPLOYMENT_ID, 50)
    expect(chart.symbol).toBe('WIN$')
    expect(chart.timeframe).toBe('H1')
    expect(chart.bars.length).toBeGreaterThan(0)
    expect(chart.indicators.some((series) => series.pane === 'price')).toBe(true)
    expect(chart.indicators.some((series) => series.pane === 'oscillator')).toBe(true)
  })

  it('stays idle when no deployment is selected', () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useDeploymentChart(null), { wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('stays idle when polling is disabled (off-route guard)', () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useDeploymentChart(DEPLOYMENT_ID, 200, { enabled: false }),
      { wrapper: Wrapper },
    )
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('resolves the chart when a deployment is selected and polling is on', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useDeploymentChart(DEPLOYMENT_ID, 60), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.bars.length).toBeGreaterThan(0)
  })

  it('does not retry a 404 (pre-WO175 backend) and surfaces the error', async () => {
    server.use(
      http.get('*/api/v1/execution/deployments/:id/chart', () =>
        HttpResponse.json({ detail: 'not found' }, { status: 404 }),
      ),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useDeploymentChart(DEPLOYMENT_ID), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
