import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { useAiStrategySession, AI_VISUAL_DONE_HOLD_MS } from '@/lib/strategies/useAiStrategySession'
import { useAppStore } from '@/store/useAppStore'
import {
  compareRevisionSections,
  createRevisionSnapshot,
} from '@/lib/strategies/aiStrategyMetadata'
import { handlers } from '@/mocks/handlers'
import { buildMockInterpretResponse } from '@/mocks/strategyBuilder'
import { createTestQueryClient } from '../../../../tests/unit/testUtils'
import {
  buildInterpretResponse,
  EMA_CROSS_SPEC,
} from '../../../../tests/unit/fixtures/strategyBuilderFixtures'

const server = setupServer(...handlers)

let interpretBodies: Record<string, unknown>[] = []
let interpretCallCount = 0

function createMockConfig() {
  const saveCustomPayload = vi.fn()
  return {
    fields: {
      strategy: 'CompositeStrategy',
      strategyParams: {},
      symbol: 'PETR4',
      timeframe: 'D1',
    },
    selectedStrategy: null,
    buildRequest: vi.fn(() => ({
      strategy: 'CompositeStrategy',
      symbol: 'PETR4',
      timeframe: 'D1',
      strategy_params: {},
    })),
    authoring: {
      customName: '',
      description: '',
      saveCustomPayload,
      newDraft: vi.fn(),
      setCustomName: vi.fn(),
      setDescription: vi.fn(),
    },
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient()
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  interpretBodies = []
  interpretCallCount = 0
  useAppStore.getState().patchBacktestSession({ aiModelSelection: null })
  server.use(
    http.post('*/api/v1/strategy-builder/interpret', async ({ request }) => {
      interpretCallCount += 1
      const body = (await request.json()) as Record<string, unknown>
      interpretBodies.push(body)
      if (interpretCallCount === 1) {
        return HttpResponse.json(
          buildInterpretResponse({
            summary: 'First draft ready.',
            questions: ['Which symbol?'],
          }),
        )
      }
      return HttpResponse.json(
        buildInterpretResponse({
          summary: 'Updated draft.',
          change_notes: ['set timeframe D1 -> H1'],
        }),
      )
    }),
  )
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useAiStrategySession transcript', () => {
  it('records a two-turn exchange with summary-only assistant wire content', async () => {
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    await act(async () => {
      await result.current.submitInterpret('Create EMA crossover')
    })

    await act(async () => {
      await result.current.submitInterpret('Switch to hourly bars')
    })

    await waitFor(() => {
      expect(result.current.transcript.filter((entry) => entry.kind === 'assistant')).toHaveLength(
        2,
      )
    })

    const kinds = result.current.transcript.map((entry) => entry.kind)
    expect(kinds).toEqual(['user', 'assistant', 'user', 'assistant'])

    expect(interpretBodies[1]).toMatchObject({
      message: 'Switch to hourly bars',
      conversation: [
        { role: 'user', content: 'Create EMA crossover' },
        { role: 'assistant', content: 'First draft ready.' },
        { role: 'user', content: 'Switch to hourly bars' },
      ],
    })
  })

  it('stores change_notes on assistant transcript entries', async () => {
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    await act(async () => {
      await result.current.submitInterpret('Create EMA crossover')
    })
    await act(async () => {
      await result.current.submitInterpret('Switch to hourly bars')
    })

    const assistantTurns = result.current.transcript.filter((entry) => entry.kind === 'assistant')
    expect(assistantTurns[1]).toMatchObject({
      change_notes: ['set timeframe D1 -> H1'],
    })
  })

  it('adds a notice turn on interpret failure without a phantom assistant turn', async () => {
    server.use(
      http.post('*/api/v1/strategy-builder/interpret', () =>
        HttpResponse.json(
          {
            detail: {
              status: 'ai_disabled',
              message: 'AI strategy interpretation is disabled.',
            },
          },
          { status: 503 },
        ),
      ),
    )

    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    await act(async () => {
      await result.current.submitInterpret('Create a strategy')
    })

    await waitFor(() => {
      expect(result.current.serviceError).toMatch(/disabled/i)
    })

    expect(result.current.transcript.map((entry) => entry.kind)).toEqual(['user', 'notice'])
    expect(result.current.conversation).toEqual([{ role: 'user', content: 'Create a strategy' }])
    expect(result.current.interpretFailed).toBe(true)
  })

  it('clears serviceError and interpretFailed when the composer message is edited', async () => {
    server.use(
      http.post('*/api/v1/strategy-builder/interpret', () =>
        HttpResponse.json(
          {
            detail: {
              status: 'ai_disabled',
              message: 'AI strategy interpretation is disabled.',
            },
          },
          { status: 503 },
        ),
      ),
    )

    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    await act(async () => {
      await result.current.submitInterpret('Create a strategy')
    })

    await waitFor(() => {
      expect(result.current.interpretFailed).toBe(true)
    })

    act(() => {
      result.current.setMessage('Revised prompt')
    })

    expect(result.current.serviceError).toBeNull()
    expect(result.current.interpretFailed).toBe(false)
  })

  it('activates doneHoldActive for 900ms after a successful interpret', async () => {
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    await act(async () => {
      await result.current.submitInterpret('Create EMA crossover')
    })

    expect(result.current.doneHoldActive).toBe(true)
    expect(AI_VISUAL_DONE_HOLD_MS).toBe(900)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, AI_VISUAL_DONE_HOLD_MS + 50))
    })
    expect(result.current.doneHoldActive).toBe(false)
  })

  it('clears doneHoldActive on resetDraft', async () => {
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    await act(async () => {
      await result.current.submitInterpret('Create EMA crossover')
    })

    expect(result.current.doneHoldActive).toBe(true)

    act(() => {
      result.current.resetDraft()
    })

    expect(result.current.doneHoldActive).toBe(false)
  })

  it('exposes hasIncrementalOutput as false until streaming API exists', async () => {
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    expect(result.current.hasIncrementalOutput).toBe(false)
  })

  it('appends a manual-edit notice when updateDraft changes the spec', async () => {
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    await act(async () => {
      await result.current.submitInterpret('Create EMA crossover')
    })

    act(() => {
      result.current.updateDraft({ ...EMA_CROSS_SPEC, name: 'Renamed Draft' })
    })

    expect(result.current.transcript.some((entry) => entry.kind === 'notice')).toBe(true)
    expect(result.current.transcript.find((entry) => entry.kind === 'notice')?.content).toMatch(
      /edited the draft manually/i,
    )
  })

  it('clears transcript, draft, and revisions on resetDraft', async () => {
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    await act(async () => {
      await result.current.submitInterpret('Create EMA crossover')
    })

    act(() => {
      result.current.resetDraft()
    })

    expect(result.current.transcript).toEqual([])
    expect(result.current.conversation).toEqual([])
    expect(result.current.revisions).toEqual([])
    expect(result.current.draftSpec).toBeNull()
  })
})

describe('useAiStrategySession provider-aware model selection', () => {
  it('selects the default provider model and sends separate provider and model fields', async () => {
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })

    act(() => {
      result.current.setSelectedModel({ provider: 'gemini', model: 'gemini-2.5-flash' })
    })
    await act(async () => {
      await result.current.submitInterpret('Create EMA crossover')
    })

    expect(interpretBodies[0]).toMatchObject({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    })
    expect(JSON.stringify(interpretBodies[0])).not.toContain('gemini::')
  })

  it('omits provider for a pre-WO200 models response', async () => {
    server.use(
      http.get('*/api/v1/strategy-builder/models', () =>
        HttpResponse.json({
          provider: 'openai_compatible',
          default_model: 'legacy-model',
          models: [{ id: 'legacy-model', label: 'Legacy model', available: true }],
        }),
      ),
    )
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'legacy-model',
      })
    })
    await act(async () => {
      await result.current.submitInterpret('Create EMA crossover')
    })

    expect(interpretBodies[0]).toMatchObject({ model: 'legacy-model' })
    expect(interpretBodies[0]).not.toHaveProperty('provider')
  })

  it('restores a persisted provider and model selection', async () => {
    useAppStore.getState().patchBacktestSession({
      aiModelSelection: { provider: 'gemini', model: 'gemini-2.5-flash' },
    })
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
      })
    })
  })

  it('replaces a stale persisted selection with the backend default', async () => {
    useAppStore.getState().patchBacktestSession({
      aiModelSelection: { provider: 'gemini', model: 'removed-model' },
    })
    const config = createMockConfig()
    const { result } = renderHook(() => useAiStrategySession({ config: config as never }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.selectedModel).toEqual({
        provider: 'openai_compatible',
        model: 'test-model-a',
      })
    })
    expect(useAppStore.getState().backtestSession.aiModelSelection).toEqual({
      provider: 'openai_compatible',
      model: 'test-model-a',
    })
  })
})

describe('compareRevisionSections', () => {
  it('diffs revision i against revision i-1', () => {
    const first = createRevisionSnapshot('first', buildMockInterpretResponse())
    const secondSpec = { ...EMA_CROSS_SPEC, timeframe: 'H1' }
    const second = createRevisionSnapshot(
      'second',
      buildMockInterpretResponse({
        strategy_spec: secondSpec,
      }),
    )

    const diff = compareRevisionSections(first, second)
    const timeframe = diff.find((entry) => entry.section === 'timeframe')

    expect(timeframe?.changed).toBe(true)
    expect(timeframe?.previous).toBe('D1')
    expect(timeframe?.current).toBe('H1')
  })
})
