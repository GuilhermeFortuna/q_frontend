import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MLFiltersTab } from '@/components/research/ml-filters/MLFiltersTab'
import { handlers } from '@/mocks/handlers'
import {
  MOCK_ML_SOURCE_FAIL_ID,
  MOCK_ML_SOURCE_INELIGIBLE_ID,
  MOCK_ML_SOURCE_NO_VOLUME_ID,
  MOCK_ML_SOURCE_OK_ID,
  resetMockMlFilterState,
} from '@/mocks/mlFilters'
import { initialMlFilterSession } from '@/store/slices/jobSessionsSlice'
import { useAppStore } from '@/store/useAppStore'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockMlFilterState()
  useAppStore.setState({ mlFilterSession: { ...initialMlFilterSession } })
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  server.resetHandlers()
})
afterAll(() => server.close())

function captureTrainingRequests() {
  const requests: Array<Record<string, unknown>> = []
  server.use(
    http.post('*/api/v1/ml-filters/training', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      requests.push(body)
      return HttpResponse.json(
        { job_id: `job-${requests.length}`, status: 'queued' },
        { status: 202 },
      )
    }),
    http.get('*/api/v1/ml-filters/training/:jobId', ({ params }) =>
      HttpResponse.json({ job_id: String(params.jobId), status: 'queued' }),
    ),
  )
  return requests
}

async function selectSource(user: ReturnType<typeof userEvent.setup>, runId: string) {
  const radio = await screen.findByRole('button', { name: new RegExp(runId.slice(0, 8)) })
  await user.click(radio)
  await screen.findByTestId('ml-filter-train-form')
}

describe('MLFiltersTab sources', () => {
  it('shows eligibility reasons for ineligible sources instead of an empty selector', async () => {
    renderWithQueryClient(<MLFiltersTab />)
    await screen.findByText(/Unavailable sources/)
    expect(
      screen.queryByRole('button', { name: new RegExp(MOCK_ML_SOURCE_INELIGIBLE_ID) }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/only single-entry runs can be used/i)).toBeInTheDocument()
  })

  it('shows an empty state when there are no sources', async () => {
    server.use(
      http.get('*/api/v1/ml-filters/sources', () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
    )
    renderWithQueryClient(<MLFiltersTab />)
    expect(await screen.findByTestId('ml-filter-sources-empty')).toBeInTheDocument()
  })

  it('selects the navigated source and summarises it', async () => {
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    const summary = await screen.findByTestId('ml-filter-source-summary')
    expect(within(summary).getByText('WIN$ M5')).toBeInTheDocument()
    expect(within(summary).getByText('412')).toBeInTheDocument()
    expect(await within(summary).findByText(/short period: 20/)).toBeInTheDocument()
  })

  it('keeps draft dates when switching stages and lets a navigated source change', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    const input = await screen.findByLabelText('Training end (exchange time)')
    await user.clear(input)
    await user.type(input, '2026-03-19T00:00')
    const workflow = screen.getByRole('radiogroup', { name: 'ML filter workflow' })
    await user.click(within(workflow).getByRole('radio', { name: 'Compare' }))
    expect(screen.getByRole('heading', { name: 'Compare on validation' })).toBeVisible()
    await user.click(within(workflow).getByRole('radio', { name: 'Train' }))
    expect(input).toHaveValue('2026-03-19T00:00')
    await selectSource(user, MOCK_ML_SOURCE_NO_VOLUME_ID)
    expect(useAppStore.getState().mlFilterSession.sourceRunId).toBe(MOCK_ML_SOURCE_NO_VOLUME_ID)
    expect(screen.getByTestId('ml-filter-source-summary')).toHaveTextContent(
      'Real volume unavailable',
    )
  })

  it('reports a missing source instead of silently clearing the selection', async () => {
    renderWithQueryClient(<MLFiltersTab sourceRunId="run-does-not-exist" />)
    expect(await screen.findByTestId('ml-filter-source-error')).toHaveTextContent(/not found/i)
  })
})

describe('MLFilterTrainForm', () => {
  it('keeps queued progress visible across stages and warns when no worker starts', async () => {
    captureTrainingRequests()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    await user.click(screen.getByTestId('ml-filter-train-submit'))
    expect(await screen.findByText('Waiting for a training worker')).toBeVisible()
    const workflow = screen.getByRole('radiogroup', { name: 'ML filter workflow' })
    await user.click(within(workflow).getByRole('radio', { name: 'Compare' }))
    expect(screen.getByTestId('ml-filter-training-progress')).toBeVisible()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000)
    })
    expect(screen.getByText('Still waiting for the worker')).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'Training progress' })).not.toHaveAttribute(
      'aria-valuenow',
    )
  })

  it('places submission errors above the setup fields', async () => {
    server.use(
      http.post('*/api/v1/ml-filters/training', () =>
        HttpResponse.json({ detail: 'Queue unavailable' }, { status: 503 }),
      ),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    await user.click(screen.getByTestId('ml-filter-train-submit'))
    const error = await screen.findByTestId('ml-filter-submit-error')
    expect(error).toBeVisible()
    expect(error).toHaveTextContent('Queue unavailable')
    expect(
      error.compareDocumentPosition(screen.getByLabelText('Training end (exchange time)')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByTestId('ml-filter-train-submit')).toBeEnabled()
  })

  it('shows saved model scores and opens the completed dataset for comparison', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    await user.click(screen.getByTestId('ml-filter-train-submit'))
    await screen.findByTestId('ml-filter-training-progress')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000)
    })
    expect(await screen.findByTestId('ml-filter-training-complete')).toBeVisible()
    await waitFor(() =>
      expect(screen.getAllByTestId('ml-filter-training-model-result')).toHaveLength(3),
    )
    expect(screen.getAllByTestId('ml-filter-training-model-result')[0]).toHaveTextContent(
      'Validation ROC AUC',
    )
    await user.click(screen.getByRole('button', { name: 'Review validation results' }))
    expect(screen.getByRole('heading', { name: 'Compare on validation' })).toBeVisible()
    expect(useAppStore.getState().mlFilterSession.datasetId).toBeTruthy()
  })

  it('defaults to all available features with mandatory side, three algorithms and seed 42', async () => {
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    expect(screen.getByLabelText('Signal side (mandatory)')).toBeChecked()
    expect(screen.getByLabelText('Signal side (mandatory)')).toBeDisabled()
    expect(screen.getByLabelText('Real volume')).toBeChecked()
    for (const name of ['LightGBM', 'Random Forest', 'Logistic regression']) {
      expect(screen.getByLabelText(name)).toBeChecked()
    }
    expect(screen.getByLabelText('Seed')).toHaveValue(42)
  })

  it('previews exchange-time boundaries with canonical UTC requests', async () => {
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    expect(screen.getByLabelText('Training end (exchange time)')).toHaveValue('2026-03-18T00:00')
    expect(screen.getByText(/UTC boundaries: 2026-03-18T03:00:00Z/)).toBeInTheDocument()
    expect(screen.getByLabelText('Validation end (exchange time)')).toHaveValue('2026-04-09T00:00')
    const ranges = screen.getByTestId('ml-filter-split-ranges')
    expect(ranges).toHaveTextContent('Reserved tail')
    expect(ranges).toHaveTextContent('2026/04/09 00:00')
  })

  it('disables real_volume when unavailable and omits it from the request', async () => {
    const requests = captureTrainingRequests()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<MLFiltersTab />)
    await selectSource(user, MOCK_ML_SOURCE_NO_VOLUME_ID)
    expect(screen.getByLabelText(/Real volume/)).toBeDisabled()
    expect(screen.getByTestId('ml-filter-volume-readiness')).toHaveTextContent(
      /real_volume is unavailable/,
    )
    await user.click(screen.getByTestId('ml-filter-train-submit'))
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].selected_features).toEqual([
      'open',
      'high',
      'low',
      'close',
      'tick_volume',
      'ma_short',
      'ma_long',
      'delta',
      'prev_delta',
      'side',
    ])
  })

  it('submits the pinned source, ordered features, UTC cutoffs, algorithms and parameters once', async () => {
    const requests = captureTrainingRequests()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    await user.click(screen.getByLabelText('Random Forest'))
    await user.click(screen.getByText('Advanced settings'))
    await user.click(screen.getByLabelText('Open'))
    const submit = screen.getByTestId('ml-filter-train-submit')
    await user.dblClick(submit)
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0]).toMatchObject({
      source_run_id: MOCK_ML_SOURCE_OK_ID,
      algorithms: ['lightgbm', 'logistic_regression'],
      seed: 42,
      train_end: '2026-03-18T03:00:00Z',
      validation_end: '2026-04-09T03:00:00Z',
      hyperparameters: {
        lightgbm: { n_estimators: 100, learning_rate: 0.1, num_leaves: 31 },
        logistic_regression: { C: 1, max_iter: 1000 },
      },
    })
    expect((requests[0].selected_features as string[])[0]).toBe('high')
    expect(requests[0].selected_features as string[]).not.toContain('open')
    await waitFor(() => expect(submit).toBeDisabled())
  })

  it('blocks submission for an invalid split and too few features', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    const validationEnd = screen.getByLabelText('Validation end (exchange time)')
    await act(async () => {
      await user.clear(validationEnd)
    })
    expect(screen.getByTestId('ml-filter-train-submit')).toBeDisabled()
    expect(screen.getByText('Enter a valid validation end.')).toBeInTheDocument()
  })

  it('shows server stages and honest rejection counts, then completion', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    await user.click(screen.getByTestId('ml-filter-train-submit'))
    await screen.findByRole('progressbar', { name: 'Training progress' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_700)
    })
    expect(screen.getByTestId('ml-filter-rejection-counts')).toHaveTextContent(
      'Not ready features 9',
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000)
    })
    expect(await screen.findByTestId('ml-filter-training-complete')).toBeInTheDocument()
    expect(screen.getAllByTestId('ml-filter-model-row').length).toBeGreaterThanOrEqual(3)
  })

  it('shows the server failure for a failed job', async () => {
    useAppStore.setState({ mlFilterSession: { ...initialMlFilterSession } })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_FAIL_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    await user.click(screen.getByTestId('ml-filter-train-submit'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    expect(await screen.findByTestId('ml-filter-training-failed')).toHaveTextContent(
      /only 61 samples remained/,
    )
  })

  it('restores the active job after a remount without keeping fake progress', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const first = renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-train-form')
    await user.click(screen.getByTestId('ml-filter-train-submit'))
    await screen.findByTestId('ml-filter-training-progress')
    first.unmount()
    expect(useAppStore.getState().mlFilterSession.trainingJobId).toMatch(/^mlf-train-/)

    renderWithQueryClient(<MLFiltersTab sourceRunId={MOCK_ML_SOURCE_OK_ID} />)
    await screen.findByTestId('ml-filter-training-progress')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000)
    })
    expect(await screen.findByTestId('ml-filter-training-complete')).toBeInTheDocument()
  })
})
