import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  deleteOptimizationStudy,
  fetchOptimizationHistory,
  useOptimizationHistory,
  useOptimizationStatus,
} from '@/api/queries/optimize'
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

describe('optimization history API', () => {
  it('fetchOptimizationHistory returns paginated items', async () => {
    const result = await fetchOptimizationHistory()

    expect(result.total).toBeGreaterThan(0)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0]).toMatchObject({
      study_id: expect.any(String),
      name: expect.any(String),
      status: expect.any(String),
      n_trials: expect.any(Number),
      completed_trials: expect.any(Number),
      created_at: expect.any(String),
    })
  })

  it('optimization status includes optimization_config for history continue', async () => {
    const { result } = renderHook(() => useOptimizationStatus('study-win-ma'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.optimization_config).toMatchObject({
      backtest: { symbol: 'WIN$' },
      study: { name: 'WIN$ MA sweep' },
    })
  })

  it('useOptimizationHistory hook loads list via MSW', async () => {
    const { result } = renderHook(() => useOptimizationHistory(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.items.length).toBeGreaterThan(0)
    expect(result.current.data?.total).toBe(result.current.data?.items.length)
  })

  it('deleteOptimizationStudy removes a study from history', async () => {
    const before = await fetchOptimizationHistory()
    const studyId = before.items[0].study_id

    await deleteOptimizationStudy(studyId)

    const after = await fetchOptimizationHistory()
    expect(after.total).toBe(before.total - 1)
    expect(after.items.find((study) => study.study_id === studyId)).toBeUndefined()
  })
})
