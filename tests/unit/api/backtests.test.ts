import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  bulkDeleteBacktestRuns,
  deleteBacktestRun,
  fetchBacktestHistory,
  fetchBacktestRun,
  patchBacktestRunSaved,
  useBacktestHistory,
  useBacktestRun,
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

  it('useBacktestRun hook loads detail via MSW', async () => {
    const list = await fetchBacktestHistory()
    const runId = list.items[0].run_id

    const { result } = renderHook(() => useBacktestRun(runId), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.run_id).toBe(runId)
    expect(result.current.data?.config.symbol).toBe(result.current.data?.symbol)
  })
})
