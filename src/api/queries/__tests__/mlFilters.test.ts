import { QueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  fetchMlFilterModel,
  fetchMlFilterModels,
  fetchMlFilterSource,
  fetchMlFilterSources,
  getMlFilterErrorMessage,
  isMlFilterJobTerminal,
  startMlFilterComparison,
  startMlFilterEvaluation,
  startMlFilterTraining,
  useMlFilterComparisonJob,
  useMlFilterTrainingJob,
} from '@/api/queries/mlFilters'
import { handlers } from '@/mocks/handlers'
import {
  MOCK_ML_CONSUMED_DATASET_ID,
  MOCK_ML_INCOMPATIBLE_MODEL_ID,
  MOCK_ML_SOURCE_FAIL_ID,
  MOCK_ML_SOURCE_OK_ID,
  getMockMlTrainingRequest,
  resetMockMlFilterState,
} from '@/mocks/mlFilters'
import { createTestProviders } from '../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetMockMlFilterState())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Providers = createTestProviders(queryClient)
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => createElement(Providers, null, children),
  }
}

const TRAIN_REQUEST = {
  source_run_id: MOCK_ML_SOURCE_OK_ID,
  selected_features: ['close', 'ma_short', 'ma_long', 'side'] as const,
  algorithms: ['lightgbm', 'logistic_regression'] as const,
  seed: 42,
  train_end: '2026-03-01T03:00:00Z',
  validation_end: '2026-04-01T03:00:00Z',
}

async function trainToCompletion() {
  const { job_id } = await startMlFilterTraining({
    ...TRAIN_REQUEST,
    selected_features: [...TRAIN_REQUEST.selected_features],
    algorithms: [...TRAIN_REQUEST.algorithms],
  })
  let status = await (await import('@/api/queries/mlFilters')).fetchMlFilterTrainingJob(job_id)
  for (let i = 0; i < 12 && !isMlFilterJobTerminal(status.status); i += 1) {
    status = await (await import('@/api/queries/mlFilters')).fetchMlFilterTrainingJob(job_id)
  }
  return status
}

describe('ML filter sources', () => {
  it('lists sources with eligibility reasons for ineligible runs', async () => {
    const result = await fetchMlFilterSources()
    const ineligible = result.items.find((item) => !item.eligible)
    expect(result.items.some((item) => item.eligible)).toBe(true)
    expect(ineligible?.eligibility_reason).toEqual(expect.any(String))
  })

  it('returns source detail with split suggestion and volume readiness', async () => {
    const detail = await fetchMlFilterSource(MOCK_ML_SOURCE_OK_ID)
    expect(detail.split_suggestion).toMatchObject({
      train_end: expect.stringMatching(/Z$/),
      validation_end: expect.stringMatching(/Z$/),
    })
    expect(detail.available_features).toContain('side')
  })
})

describe('ML filter training', () => {
  it('sends the pinned source, ordered features, UTC boundaries and algorithms', async () => {
    let body: unknown = null
    server.use(
      http.post('*/api/v1/ml-filters/training', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ job_id: 'job-1', status: 'queued' }, { status: 202 })
      }),
    )
    await startMlFilterTraining({
      ...TRAIN_REQUEST,
      selected_features: [...TRAIN_REQUEST.selected_features],
      algorithms: [...TRAIN_REQUEST.algorithms],
    })
    expect(body).toEqual({
      source_run_id: MOCK_ML_SOURCE_OK_ID,
      selected_features: ['close', 'ma_short', 'ma_long', 'side'],
      algorithms: ['lightgbm', 'logistic_regression'],
      seed: 42,
      train_end: '2026-03-01T03:00:00Z',
      validation_end: '2026-04-01T03:00:00Z',
    })
  })

  it('progresses through server stages and persists models on completion', async () => {
    const status = await trainToCompletion()
    expect(status.status).toBe('completed')
    expect(status.model_version_ids).toHaveLength(2)
    expect(status.dataset_id).toEqual(expect.any(String))
    const models = await fetchMlFilterModels({ dataset_id: status.dataset_id as string })
    expect(models.items.map((item) => item.algorithm).sort()).toEqual([
      'lightgbm',
      'logistic_regression',
    ])
  })

  it('reports failures with server error codes and honest counts', async () => {
    const { job_id } = await startMlFilterTraining(
      getMockMlTrainingRequest({ source_run_id: MOCK_ML_SOURCE_FAIL_ID }),
    )
    const { fetchMlFilterTrainingJob } = await import('@/api/queries/mlFilters')
    let status = await fetchMlFilterTrainingJob(job_id)
    for (let i = 0; i < 12 && !isMlFilterJobTerminal(status.status); i += 1) {
      status = await fetchMlFilterTrainingJob(job_id)
    }
    expect(status.status).toBe('failed')
    expect(status.error?.code).toBe('training_failed')
    expect(status.rejections).toBeTruthy()
  })

  it('polls until the job is terminal and stops afterwards', async () => {
    const { Wrapper } = createWrapper()
    const { job_id } = await startMlFilterTraining(getMockMlTrainingRequest())
    const { result } = renderHook(() => useMlFilterTrainingJob(job_id, { pollMs: 5 }), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(result.current.data?.status).toBe('completed'), { timeout: 4000 })
    const calls = result.current.dataUpdatedAt
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(result.current.dataUpdatedAt).toBe(calls)
  })

  it('does not rely on cached progress after reload: a fresh client reads terminal state', async () => {
    const status = await trainToCompletion()
    const { Wrapper } = createWrapper()
    const jobId = status.job_id
    const { result } = renderHook(() => useMlFilterTrainingJob(jobId, { pollMs: 5 }), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(result.current.data?.status).toBe('completed'))
  })

  it('rejects an invalid split with the server code', async () => {
    await expect(
      startMlFilterTraining(
        getMockMlTrainingRequest({
          train_end: '2026-04-01T03:00:00Z',
          validation_end: '2026-03-01T03:00:00Z',
        }),
      ),
    ).rejects.toSatisfy((error) => getMlFilterErrorMessage(error).includes('train_end'))
  })
})

describe('ML filter models', () => {
  it('lists compatible and incompatible versions with reasons', async () => {
    const models = await fetchMlFilterModels()
    const incompatible = models.items.find(
      (item) => item.model_version_id === MOCK_ML_INCOMPATIBLE_MODEL_ID,
    )
    expect(models.items.some((item) => item.ready)).toBe(true)
    expect(incompatible?.ready).toBe(false)
    expect(incompatible?.compatibility_reasons?.length).toBeGreaterThan(0)
  })

  it('returns provenance with the source run id for Use in Backtest', async () => {
    const models = await fetchMlFilterModels()
    const ready = models.items.find((item) => item.ready)
    const detail = await fetchMlFilterModel(ready?.model_version_id as string)
    expect(detail.provenance?.source_run_id).toEqual(expect.any(String))
  })
})

describe('ML filter comparison', () => {
  async function trainedModelIds() {
    const status = await trainToCompletion()
    return {
      datasetId: status.dataset_id as string,
      modelIds: status.model_version_ids as string[],
    }
  }

  it('retains the submitted threshold on results and never relabels it', async () => {
    const { datasetId, modelIds } = await trainedModelIds()
    const { fetchMlFilterComparisonJob } = await import('@/api/queries/mlFilters')
    const first = await startMlFilterComparison({
      dataset_id: datasetId,
      model_version_ids: modelIds,
      threshold: 0.5,
    })
    const second = await startMlFilterComparison({
      dataset_id: datasetId,
      model_version_ids: modelIds,
      threshold: 0.7,
    })
    expect(second.job_id).not.toBe(first.job_id)
    let a = await fetchMlFilterComparisonJob(first.job_id)
    let b = await fetchMlFilterComparisonJob(second.job_id)
    for (let i = 0; i < 6; i += 1) {
      a = await fetchMlFilterComparisonJob(first.job_id)
      b = await fetchMlFilterComparisonJob(second.job_id)
    }
    expect(a.results?.every((entry) => entry.threshold === 0.5)).toBe(true)
    expect(b.results?.every((entry) => entry.threshold === 0.7)).toBe(true)
  })

  it('surfaces undefined metrics with a server reason instead of a number', async () => {
    const { datasetId, modelIds } = await trainedModelIds()
    const { Wrapper } = createWrapper()
    const { job_id } = await startMlFilterComparison({
      dataset_id: datasetId,
      model_version_ids: modelIds,
    })
    const { result } = renderHook(() => useMlFilterComparisonJob(job_id, { pollMs: 5 }), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(result.current.data?.status).toBe('completed'))
    const undefinedMetrics = result.current.data?.results?.flatMap((entry) => [
      entry.classification?.roc_auc,
      entry.filtered?.profit_factor,
    ])
    expect(
      undefinedMetrics?.some((metric) => metric?.value == null && metric?.unavailable_reason),
    ).toBe(true)
  })

  it('rejects models from another dataset as incompatible', async () => {
    const { datasetId } = await trainedModelIds()
    await expect(
      startMlFilterComparison({
        dataset_id: datasetId,
        model_version_ids: [MOCK_ML_INCOMPATIBLE_MODEL_ID],
      }),
    ).rejects.toSatisfy((error) => getMlFilterErrorMessage(error).length > 0)
  })
})

describe('ML filter final evaluation', () => {
  it('returns the existing job when the same tuple is retried', async () => {
    const status = await trainToCompletion()
    const request = {
      dataset_id: status.dataset_id as string,
      model_version_id: (status.model_version_ids as string[])[0],
      threshold: 0.5,
    }
    const first = await startMlFilterEvaluation(request)
    const retry = await startMlFilterEvaluation(request)
    expect(retry.job_id).toBe(first.job_id)
  })

  it('rejects a different selection once the reserved tail is consumed', async () => {
    const status = await trainToCompletion()
    const datasetId = status.dataset_id as string
    const [a, b] = status.model_version_ids as string[]
    await startMlFilterEvaluation({ dataset_id: datasetId, model_version_id: a, threshold: 0.5 })
    await expect(
      startMlFilterEvaluation({ dataset_id: datasetId, model_version_id: b, threshold: 0.5 }),
    ).rejects.toSatisfy((error) => getMlFilterErrorMessage(error).includes('reserved tail'))
  })

  it('reports lockbox_consumed for a dataset consumed by another tuple', async () => {
    await expect(
      startMlFilterEvaluation({
        dataset_id: MOCK_ML_CONSUMED_DATASET_ID,
        model_version_id: 'any-model',
        threshold: 0.5,
      }),
    ).rejects.toSatisfy((error) => getMlFilterErrorMessage(error).includes('reserved tail'))
  })
})
