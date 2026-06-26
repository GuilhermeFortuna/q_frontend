import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  fetchFeatureList,
  fetchFeaturePassport,
  featureKeys,
  useFeatureList,
  useFeaturePassport,
} from '@/api/queries/features'
import { handlers, resetMockFeatureDeletes } from '@/mocks/handlers'
import { resetMockFeatureState } from '@/mocks/features'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureDeletes()
  resetMockFeatureState()
})
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

describe('features API', () => {
  it('fetchFeatureList returns typed catalog rows from MSW fixtures', async () => {
    const result = await fetchFeatureList()

    expect(result.features.length).toBeGreaterThan(0)
    expect(result.features[0]).toMatchObject({
      name: expect.any(String),
      category: expect.any(String),
      latest_version: expect.any(Number),
      status: expect.stringMatching(/experimental|candidate|production/),
      usage_count: expect.any(Number),
    })
  })

  it('fetchFeaturePassport returns a passport with versions and history', async () => {
    const passport = await fetchFeaturePassport('rsi')

    expect(passport.name).toBe('rsi')
    expect(passport.versions[0]).toMatchObject({
      version: expect.any(Number),
      status: expect.stringMatching(/experimental|candidate|production/),
      node_kind: expect.any(String),
      param_keys: expect.any(Array),
      leakage_status: expect.any(String),
    })
    expect(passport.evaluation_history.length).toBeGreaterThan(0)
  })

  it('featureKeys.list namespaces list queries by filter params', () => {
    expect(featureKeys.list({ category: 'momentum' })).toEqual([
      'features',
      'list',
      { category: 'momentum' },
    ])
  })

  it('useFeatureList resolves against MSW handlers', async () => {
    const { result } = renderHook(() => useFeatureList(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.data?.features.length).toBeGreaterThan(0)
    })

    expect(result.current.data?.features.some((feature) => feature.name === 'rsi')).toBe(true)
  })

  it('useFeaturePassport stays disabled without a feature name', () => {
    const { result } = renderHook(() => useFeaturePassport(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('useFeaturePassport resolves a passport for a named feature', async () => {
    const { result } = renderHook(() => useFeaturePassport('macd'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.data?.name).toBe('macd')
    })

    expect(result.current.data?.category).toBe('momentum')
  })
})
