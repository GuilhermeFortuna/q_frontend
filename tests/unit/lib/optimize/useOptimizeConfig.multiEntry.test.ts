import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import { handlers } from '@/mocks/handlers'
import { useAppStore } from '@/store/useAppStore'
import { createTestQueryClient } from '../../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  useAppStore.setState({ pendingOptimizationConfig: null })
})
afterAll(() => server.close())

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return { ...actual, fetchOhlcvAvailableRange: vi.fn() }
})

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient()
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useOptimizeConfig multi-entry', () => {
  it('buildOptimizationConfigPayload carries namespaced entries and manager for multi-instance', async () => {
    const { result } = renderHook(() => useOptimizeConfig(), { wrapper })

    await waitFor(() => {
      expect(result.current.entries.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.setters.addEntry('RSIMeanReversion')
      result.current.setters.setEntryManager({ kind: 'and', params: {} })
    })

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
    })

    const payload = result.current.buildOptimizationConfig()

    expect(payload.backtest.entries).toEqual([
      { strategy: 'MACrossover', params: expect.any(Object) },
      { strategy: 'RSIMeanReversion', params: expect.any(Object) },
    ])
    expect(payload.backtest.entry_manager).toEqual({ kind: 'and', params: {} })
    expect(payload.search_space.strategy_params).toMatchObject({
      e0__short_period: expect.objectContaining({ type: 'int' }),
      e1__period: expect.objectContaining({ type: 'int' }),
    })
    expect(payload.search_space.strategy_params.short_period).toBeUndefined()
  })

  it('keeps duplicate instances independent in the search space', async () => {
    const { result } = renderHook(() => useOptimizeConfig(), { wrapper })

    await waitFor(() => {
      expect(result.current.entries.length).toBe(1)
    })

    act(() => {
      result.current.setters.addEntry('MACrossover')
    })

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
    })

    const [first, second] = result.current.entries
    act(() => {
      result.current.setters.handleEntrySearchSpaceChange(first.slotId, 'short_period', {
        kind: 'numeric',
        low: 3,
        high: 12,
        step: 1,
      })
      result.current.setters.handleEntrySearchSpaceChange(second.slotId, 'short_period', {
        kind: 'numeric',
        low: 20,
        high: 40,
        step: 1,
      })
    })

    const payload = result.current.buildOptimizationConfig()
    expect(payload.search_space.strategy_params.e0__short_period).toEqual({
      type: 'int',
      low: 3,
      high: 12,
      step: 1,
    })
    expect(payload.search_space.strategy_params.e1__short_period).toEqual({
      type: 'int',
      low: 20,
      high: 40,
      step: 1,
    })
  })

  it('buildOptimizationConfigPayload keeps back-compatible payload for single instance OR', async () => {
    const { result } = renderHook(() => useOptimizeConfig(), { wrapper })

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1)
      expect(result.current.entryManager.kind).toBe('or')
    })

    const payload = result.current.buildOptimizationConfig()

    expect(payload.backtest.strategy).toBe('MACrossover')
    expect(payload.backtest.entries).toBeUndefined()
    expect(payload.search_space.strategy_params).toMatchObject({
      short_period: expect.objectContaining({ type: 'int' }),
      long_period: expect.objectContaining({ type: 'int' }),
    })
    expect(payload.search_space.strategy_params['e0__short_period']).toBeUndefined()
  })
})
