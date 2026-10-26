import axios, { type AxiosError } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  backtestKeys,
  bulkDeleteBacktestRuns,
  cancelBacktest,
  fetchBacktestJobStatus,
  fetchBacktestTradesCsv,
  fetchPostExitAnalysis,
  startBacktest,
  useCancelBacktest,
  deleteBacktestRun,
  fetchBacktestEquityArtifact,
  fetchBacktestHistory,
  fetchBacktestRun,
  patchBacktestRunSaved,
  useBacktestHistory,
  useBacktestRun,
  useStoredBacktestResult,
  usePostExitAnalysis,
} from '@/api/queries/backtests'
import { handlers, resetMockBacktestDeletes } from '@/mocks/handlers'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockBacktestDeletes()
})
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

describe('backtest history API', () => {
  it('fetches post-exit values for the selected bar window', async () => {
    let requestedBars = ''
    server.use(
      http.get('*/api/v1/backtests/run-1/post-exit', ({ request }) => {
        requestedBars = new URL(request.url).searchParams.get('bars') ?? ''
        return HttpResponse.json({
          post_exit_bars: 3,
          trades: [],
          all: { avg_post_exit_return: 1, post_exit_continuation_rate: 0.5 },
          long: { avg_post_exit_return: 1, post_exit_continuation_rate: 1 },
          short: { avg_post_exit_return: -1, post_exit_continuation_rate: 0 },
        })
      }),
    )

    const result = await fetchPostExitAnalysis('run-1', 3)

    expect(requestedBars).toBe('3')
    expect(result.post_exit_bars).toBe(3)
  })

  it('passes the selected post-exit window to trades CSV export', async () => {
    let requestedBars = ''
    server.use(
      http.get('*/api/v1/backtests/run-1/export/trades', ({ request }) => {
        requestedBars = new URL(request.url).searchParams.get('post_exit_bars') ?? ''
        return new HttpResponse('trade_id\n', { headers: { 'Content-Type': 'text/csv' } })
      }),
    )

    await fetchBacktestTradesCsv('run-1', 7)

    expect(requestedBars).toBe('7')
  })

  it('debounces the post-exit query and loads the selected values', async () => {
    server.use(
      http.get('*/api/v1/backtests/run-1/post-exit', () =>
        HttpResponse.json({
          post_exit_bars: 4,
          trades: [],
          all: { avg_post_exit_return: 1, post_exit_continuation_rate: 0.5 },
          long: { avg_post_exit_return: 1, post_exit_continuation_rate: 1 },
          short: { avg_post_exit_return: -1, post_exit_continuation_rate: 0 },
        }),
      ),
    )
    const { result } = renderHook(() => usePostExitAnalysis('run-1', 4, 10), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data?.post_exit_bars).toBe(4))
  })
  it('fetchBacktestHistory returns paginated items', async () => {
    const result = await fetchBacktestHistory()

    expect(result.total).toBeGreaterThan(0)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0]).toMatchObject({
      run_id: expect.any(String),
      symbol: expect.any(String),
      strategy: expect.any(String),
      timeframe: expect.any(String),
      status: expect.any(String),
      created_at: expect.any(String),
    })
  })

  it('fetchBacktestRun returns a run detail with config', async () => {
    const list = await fetchBacktestHistory()
    const runId = list.items[0].run_id

    const detail = await fetchBacktestRun(runId)

    expect(detail.run_id).toBe(runId)
    expect(detail.config).toMatchObject({
      symbol: detail.symbol,
      strategy: detail.strategy,
    })
    expect(detail).not.toHaveProperty('trades')
    expect(detail).not.toHaveProperty('bars')
    expect(detail).not.toHaveProperty('indicators')
  })

  it('failed runs expose null summary and result_summary', async () => {
    const list = await fetchBacktestHistory()
    const failed = list.items.find((run) => run.status === 'failed')
    expect(failed).toBeDefined()
    expect(failed?.summary).toBeNull()

    const detail = await fetchBacktestRun(failed!.run_id)
    expect(detail.result_summary).toBeNull()
    expect(detail.error_message).toBeTruthy()
  })

  it('useBacktestHistory hook loads list via MSW', async () => {
    const { result } = renderHook(() => useBacktestHistory(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.items.length).toBeGreaterThan(0)
    expect(result.current.data?.total).toBe(result.current.data?.items.length)
  })

  it('fetchBacktestHistory supports saved filter and sort params', async () => {
    const saved = await fetchBacktestHistory({ saved_only: true })
    expect(saved.items.every((run) => run.is_saved)).toBe(true)

    const sorted = await fetchBacktestHistory({ sort: 'pnl_desc' })
    expect(sorted.items.length).toBeGreaterThan(0)
  })

  it('patchBacktestRunSaved toggles bookmark state', async () => {
    const list = await fetchBacktestHistory()
    const runId = list.items.find((run) => !run.is_saved)?.run_id
    expect(runId).toBeDefined()

    const saved = await patchBacktestRunSaved(runId!, true)
    expect(saved.is_saved).toBe(true)

    const unsaved = await patchBacktestRunSaved(runId!, false)
    expect(unsaved.is_saved).toBe(false)
  })

  it('bulkDeleteBacktestRuns removes multiple runs', async () => {
    const before = await fetchBacktestHistory()
    const ids = before.items.slice(0, 2).map((run) => run.run_id)

    const result = await bulkDeleteBacktestRuns([...ids, 'missing-id'])
    expect(result.deleted).toBe(ids.length)
    expect(result.not_found).toContain('missing-id')

    const after = await fetchBacktestHistory()
    expect(after.total).toBe(before.total - ids.length)
  })

  it('deleteBacktestRun removes a run from history', async () => {
    const before = await fetchBacktestHistory()
    const runId = before.items[0].run_id

    await deleteBacktestRun(runId)

    const after = await fetchBacktestHistory()
    expect(after.total).toBe(before.total - 1)
    expect(after.items.find((run) => run.run_id === runId)).toBeUndefined()
  })

  it('fetchBacktestEquityArtifact returns points for artifact runs', async () => {
    const artifact = await fetchBacktestEquityArtifact('run-win-ma')

    expect(artifact.availability).toBe('available')
    expect(artifact.points.length).toBeGreaterThan(0)
    expect(artifact.points[0]).toMatchObject({
      time: expect.any(String),
      equity: expect.any(Number),
    })
  })

  it('fetchBacktestEquityArtifact resolves unavailable on 404', async () => {
    const artifact = await fetchBacktestEquityArtifact('run-petr-failed')

    expect(artifact.availability).toBe('unavailable')
    expect(artifact.points).toEqual([])
  })

  it('useBacktestRun hook loads detail via MSW', async () => {
    const list = await fetchBacktestHistory()
    const runId = list.items[0].run_id

    const { result } = renderHook(() => useBacktestRun(runId), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.run_id).toBe(runId)
    expect(result.current.data?.config.symbol).toBe(result.current.data?.symbol)
  })

  it('fetchBacktestHistory filters by origin', async () => {
    const scriptRuns = await fetchBacktestHistory({ origin: 'script' })

    expect(scriptRuns.items.length).toBeGreaterThan(0)
    expect(scriptRuns.items.every((run) => run.origin === 'script')).toBe(true)
  })

  it('useStoredBacktestResult loads the stored result of a completed stack run', async () => {
    const { result } = renderHook(() => useStoredBacktestResult('run-win-ma'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.run_id).toBe('run-win-ma')
    expect(result.current.data?.bars.length).toBeGreaterThan(0)
    expect(result.current.data?.trades.length).toBeGreaterThan(0)
  })

  it('useStoredBacktestResult reports a 404 without retrying', async () => {
    const { result } = renderHook(() => useStoredBacktestResult('run-script-missing'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(axios.isAxiosError(result.current.error)).toBe(true)
    expect((result.current.error as AxiosError).response?.status).toBe(404)
    expect(result.current.failureCount).toBe(1)
  })
})

describe('backtest cancellation', () => {
  const request = {
    symbol: 'WIN$',
    timeframe: 'M5',
    strategy: 'MACrossover',
  } as Parameters<typeof startBacktest>[0]

  it('cancelBacktest returns the cancelled status and later polls agree', async () => {
    const { run_id } = await startBacktest(request)

    const cancelled = await cancelBacktest(run_id)

    expect(cancelled).toMatchObject({ run_id, status: 'cancelled' })
    expect(await fetchBacktestJobStatus(run_id)).toMatchObject({ run_id, status: 'cancelled' })
  })

  it('cancelBacktest rejects for an unknown run', async () => {
    await expect(cancelBacktest('missing-run')).rejects.toMatchObject({
      response: { status: 404 },
    })
  })

  it('useCancelBacktest writes the cancelled status into the status cache', async () => {
    const { run_id } = await startBacktest(request)
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const { result } = renderHook(() => useCancelBacktest(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(run_id)
    })

    expect(queryClient.getQueryData(backtestKeys.jobStatus(run_id))).toMatchObject({
      status: 'cancelled',
    })
  })
})
