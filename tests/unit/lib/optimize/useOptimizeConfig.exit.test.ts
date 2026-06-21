import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import { handlers } from '@/mocks/handlers'
import { resetMockCustomStrategies } from '@/mocks/data'
import { useAppStore } from '@/store/useAppStore'
import { createTestQueryClient } from '../../testUtils'
import {
  mockOptimizeCustomSaved,
  mockOptimizeCustomStrategy,
  strategiesWithCustomCustom,
} from '../../fixtures/optimizeCustomStrategyFixtures'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockCustomStrategies()
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

function useCustomStrategyMocks() {
  server.use(
    http.get('*/api/v1/strategies', () => HttpResponse.json(strategiesWithCustomCustom())),
    http.get('*/api/v1/strategies/custom', () => HttpResponse.json([mockOptimizeCustomSaved])),
  )
}

describe('useOptimizeConfig exit strategies', () => {
  it('derives applicable exit rules from the catalog and selected strategy params', async () => {
    useCustomStrategyMocks()
    const { result } = renderHook(() => useOptimizeConfig(), { wrapper })

    await waitFor(() => {
      expect(result.current.selectedStrategy?.name).toBe('MACrossover')
    })

    act(() => {
      result.current.setters.handleStrategyChange(mockOptimizeCustomStrategy.name)
    })

    await waitFor(() => {
      expect(result.current.applicableExitRules.map((rule) => rule.id)).toEqual([
        'fixed_sl',
        'trailing_pct',
      ])
    })
  })

  it('initializes enabled exits from default-on enable params', async () => {
    useCustomStrategyMocks()
    const { result } = renderHook(() => useOptimizeConfig(), { wrapper })

    await waitFor(() => {
      expect(result.current.selectedStrategy?.name).toBe('MACrossover')
    })

    act(() => {
      result.current.setters.handleStrategyChange(mockOptimizeCustomStrategy.name)
    })

    await waitFor(() => {
      expect(result.current.enabledExitRuleIds.has('fixed_sl')).toBe(true)
      expect(result.current.enabledExitRuleIds.has('trailing_pct')).toBe(true)
    })
  })

  it('toggleExitRule flips membership in enabledExitRuleIds', async () => {
    useCustomStrategyMocks()
    const { result } = renderHook(() => useOptimizeConfig(), { wrapper })

    await waitFor(() => {
      expect(result.current.selectedStrategy?.name).toBe('MACrossover')
    })

    act(() => {
      result.current.setters.handleStrategyChange(mockOptimizeCustomStrategy.name)
    })

    await waitFor(() => {
      expect(result.current.enabledExitRuleIds.has('fixed_sl')).toBe(true)
    })

    act(() => {
      result.current.toggleExitRule('fixed_sl')
    })

    expect(result.current.enabledExitRuleIds.has('fixed_sl')).toBe(false)

    act(() => {
      result.current.toggleExitRule('fixed_sl')
    })

    expect(result.current.enabledExitRuleIds.has('fixed_sl')).toBe(true)
  })
})
