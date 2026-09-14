import { QueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchNeuralModels,
  fetchNeuralVersion,
  neuralKeys,
  setNeuralModelStatus,
  startNeuralTraining,
  useNeuralModels,
  useNeuralTrainingRun,
  useNeuralVersion,
  useSetNeuralModelStatus,
  useStartNeuralTraining,
} from '@/api/queries/neural'
import { handlers, resetMockFeatureDeletes } from '@/mocks/handlers'
import { createTestProviders } from '../../../../tests/unit/testUtils'
import {
  MOCK_NEURAL_ARCHIVED_HASH,
  MOCK_NEURAL_CANDIDATE_HASH,
  resetMockNeuralState,
} from '@/mocks/neural'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureDeletes()
  resetMockNeuralState()
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

  return {
    queryClient,
    Wrapper({ children }: { children: ReactNode }) {
      const Providers = createTestProviders(queryClient)
      return createElement(Providers, null, children)
    },
  }
}

describe('neural API', () => {
  it('fetchNeuralModels returns typed model rows from MSW fixtures', async () => {
    const result = await fetchNeuralModels()

    expect(result.models.length).toBeGreaterThan(0)
    expect(result.models[0]).toMatchObject({
      model_hash: expect.any(String),
      model_key: expect.any(String),
      symbol: expect.any(String),
      timeframe: expect.any(String),
      version: expect.any(Number),
      status: expect.stringMatching(/trained|candidate|production|archived/),
      n_latents: expect.any(Number),
      created_at: expect.any(String),
      val_metrics: expect.any(Object),
    })
  })

  it('fetchNeuralVersion returns detail with gate result and training window', async () => {
    const detail = await fetchNeuralVersion(MOCK_NEURAL_CANDIDATE_HASH)

    expect(detail.model_hash).toBe(MOCK_NEURAL_CANDIDATE_HASH)
    expect(detail.train_start).toEqual(expect.any(String))
    expect(detail.train_end).toEqual(expect.any(String))
    expect(detail.latent_names.length).toBeGreaterThan(0)
    expect(detail.gate_result).toMatchObject({
      baseline_ic: expect.any(Number),
      best_latent_ic: expect.any(Number),
      passed: expect.any(Boolean),
    })
  })

  it('neuralKeys.list namespaces list queries by filter params', () => {
    expect(neuralKeys.list({ status: 'candidate' })).toEqual([
      'neural',
      'list',
      { status: 'candidate' },
    ])
  })

  it('useNeuralModels resolves against MSW handlers', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useNeuralModels(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.data?.models.length).toBeGreaterThan(0)
    })

    expect(
      result.current.data?.models.some((model) => model.model_hash === MOCK_NEURAL_CANDIDATE_HASH),
    ).toBe(true)
  })

  it('useNeuralVersion stays disabled without a model hash', () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useNeuralVersion(null), {
      wrapper: Wrapper,
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('useSetNeuralModelStatus invalidates list and version queries on success', async () => {
    const { queryClient, Wrapper } = createWrapper()
    await queryClient.prefetchQuery({
      queryKey: neuralKeys.list(),
      queryFn: () => fetchNeuralModels(),
    })
    await queryClient.prefetchQuery({
      queryKey: neuralKeys.version(MOCK_NEURAL_CANDIDATE_HASH),
      queryFn: () => fetchNeuralVersion(MOCK_NEURAL_CANDIDATE_HASH),
    })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useSetNeuralModelStatus(), {
      wrapper: Wrapper,
    })

    result.current.mutate({ modelHash: MOCK_NEURAL_CANDIDATE_HASH, status: 'production' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...neuralKeys.all, 'list'] })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: neuralKeys.version(MOCK_NEURAL_CANDIDATE_HASH),
    })
    expect(result.current.data?.status).toBe('production')
  })

  it('setNeuralModelStatus propagates a 409 for illegal transitions', async () => {
    await expect(
      setNeuralModelStatus(MOCK_NEURAL_ARCHIVED_HASH, 'production'),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        data: {
          detail: expect.stringContaining('Illegal transition'),
        },
      },
    })
  })

  it('useSetNeuralModelStatus surfaces 409 detail to callers', async () => {
    server.use(
      http.post('*/api/v1/neural/models/:modelHash/status', () =>
        HttpResponse.json(
          { detail: 'Illegal transition from archived to production.' },
          { status: 409 },
        ),
      ),
    )

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useSetNeuralModelStatus(), {
      wrapper: Wrapper,
    })

    result.current.mutate({ modelHash: MOCK_NEURAL_ARCHIVED_HASH, status: 'production' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toMatchObject({
      response: {
        status: 409,
        data: { detail: 'Illegal transition from archived to production.' },
      },
    })
  })

  it('useStartNeuralTraining returns a job_id', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useStartNeuralTraining(), {
      wrapper: Wrapper,
    })

    result.current.mutate({
      kind: 'autoencoder',
      symbol: 'EURUSD',
      timeframe: 'H1',
      train_start: '2024-01-01T00:00:00.000Z',
      train_end: '2024-06-01T00:00:00.000Z',
      n_latents: 4,
      input_features: ['rsi', 'macd'],
      evaluate: { target: 'fwd_return', horizon: 5 },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.job_id).toMatch(/^train_/)
  })

  it('useNeuralTrainingRun polls while running and stops on completion', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const started = await startNeuralTraining({
      kind: 'pca',
      symbol: 'EURUSD',
      timeframe: 'H1',
      train_start: '2024-01-01T00:00:00.000Z',
      train_end: '2024-06-01T00:00:00.000Z',
      n_latents: 4,
      input_features: ['rsi', 'macd'],
    })

    const { Wrapper } = createWrapper()
    const { result, rerender } = renderHook(
      ({ isRunning }: { isRunning: boolean }) =>
        useNeuralTrainingRun(started.job_id, { isRunning }),
      {
        wrapper: Wrapper,
        initialProps: { isRunning: true },
      },
    )

    await waitFor(() => {
      expect(result.current.data?.status).toBe('queued')
    })

    await vi.advanceTimersByTimeAsync(1_500)

    await waitFor(() => {
      expect(result.current.data?.status).toBe('running')
    })

    await vi.advanceTimersByTimeAsync(2_500)

    await waitFor(() => {
      expect(result.current.data?.status).toBe('completed')
    })

    rerender({ isRunning: false })
    expect(result.current.data?.model_hash).toMatch(/^mock_trained_/)

    vi.useRealTimers()
  })
})
