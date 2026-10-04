import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { useState } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MLFilterComparison } from '@/components/research/ml-filters/MLFilterComparison'
import { MLFilterEvaluation } from '@/components/research/ml-filters/MLFilterEvaluation'
import { handlers } from '@/mocks/handlers'
import { resetMockMlFilterState, startMockMlEvaluation } from '@/mocks/mlFilters'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'
import { trainMockModels } from './mlFilterTestUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockMlFilterState()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  server.resetHandlers()
})
afterAll(() => server.close())

type Selection = { dataset_id: string; model_version_id: string; threshold: number }

function Harness({
  datasetId,
  initialFrozen = null,
}: {
  datasetId: string
  initialFrozen?: Selection | null
}) {
  const [frozen, setFrozen] = useState<Selection | null>(initialFrozen)
  const [jobId, setJobId] = useState<string | null>(null)
  const [comparisonJobId, setComparisonJobId] = useState<string | null>(null)
  return (
    <>
      <MLFilterComparison
        datasetId={datasetId}
        jobId={comparisonJobId}
        onJobStarted={setComparisonJobId}
      />
      <MLFilterEvaluation
        datasetId={datasetId}
        frozen={frozen}
        jobId={jobId}
        onFreeze={setFrozen}
        onJobStarted={setJobId}
      />
    </>
  )
}

async function settle(ms = 3_000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('MLFilterEvaluation', () => {
  it('requires confirmation and shows the selection that will be frozen', async () => {
    const { datasetId, modelIds } = trainMockModels()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<Harness datasetId={datasetId} />)
    const submit = await screen.findByTestId('ml-filter-evaluate-submit')
    expect(submit).toBeDisabled()
    expect(await screen.findByTestId('ml-filter-frozen-selection')).toHaveTextContent(
      `Selection to freeze: ${modelIds[0]} at threshold 0.50`,
    )
    expect(
      screen.getByText(/does not claim the original source backtest was never inspected/i),
    ).toBeInTheDocument()
    await user.click(screen.getByLabelText(/consumes the reserved tail/))
    expect(submit).toBeEnabled()
  })

  it('freezes before dispatch, locks the form and keeps tail results out of the validation table', async () => {
    const { datasetId, modelIds } = trainMockModels()
    const sent: Selection[] = []
    server.use(
      http.post('*/api/v1/ml-filters/evaluations', async ({ request }) => {
        sent.push((await request.json()) as Selection)
        return HttpResponse.json({ job_id: 'eval-1', status: 'queued' }, { status: 202 })
      }),
      http.get('*/api/v1/ml-filters/evaluations/:jobId', () =>
        HttpResponse.json({
          job_id: 'eval-1',
          status: 'completed',
          dataset_id: datasetId,
          model_version_id: modelIds[1],
          threshold: 0.5,
          result: {
            baseline: {
              net_pnl: 640,
              max_drawdown: -410,
              trade_count: 31,
              profit_factor: { value: 1.09 },
            },
            filtered: {
              net_pnl: 777.77,
              max_drawdown: -280.5,
              trade_count: 17,
              profit_factor: { value: null, unavailable_reason: 'No losing trades in the tail.' },
            },
          },
        }),
      ),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<Harness datasetId={datasetId} />)
    await user.click(await screen.findByTestId('ml-filter-compare-submit'))
    await settle()
    await screen.findByTestId('ml-filter-comparison-table')

    await user.click(
      await screen.findByLabelText(new RegExp(`${modelIds[1]}$`, 'i'), {
        selector: '#ml-final-' + modelIds[1],
      }),
    )
    await user.click(screen.getByLabelText(/consumes the reserved tail/))
    await user.click(screen.getByTestId('ml-filter-evaluate-submit'))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]).toEqual({
      dataset_id: datasetId,
      model_version_id: modelIds[1],
      threshold: 0.5,
    })
    await settle(1_000)
    const result = await screen.findByTestId('ml-filter-evaluation-result')
    expect(result).toHaveTextContent('777.77')
    expect(result).toHaveTextContent('No losing trades in the tail.')
    expect(result).toHaveTextContent('separate from the validation comparison')
    expect(screen.getByTestId('ml-filter-frozen-selection')).toHaveTextContent('Frozen selection')
    expect(screen.queryByTestId('ml-filter-evaluate-submit')).not.toBeInTheDocument()
    expect(screen.getByTestId('ml-filter-comparison-table')).not.toHaveTextContent('777.77')
  })

  it('retrying the identical frozen selection reopens the existing evaluation', async () => {
    const { datasetId, modelIds } = trainMockModels()
    const frozen = { dataset_id: datasetId, model_version_id: modelIds[0], threshold: 0.5 }
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // The first dispatch reached the server, but its response never reached the client.
    startMockMlEvaluation(frozen)
    renderWithQueryClient(<Harness datasetId={datasetId} initialFrozen={frozen} />)
    await user.click(await screen.findByTestId('ml-filter-evaluate-retry'))
    await settle(4_000)
    expect(await screen.findByTestId('ml-filter-evaluation-result')).toBeInTheDocument()
    expect(screen.queryByTestId('ml-filter-evaluation-error')).not.toBeInTheDocument()
  })

  it('shows a conflict and blocks a different selection once the tail is consumed', async () => {
    const { datasetId, modelIds } = trainMockModels()
    startMockMlEvaluation({ dataset_id: datasetId, model_version_id: modelIds[0], threshold: 0.5 })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<Harness datasetId={datasetId} />)
    await user.click(
      await screen.findByLabelText(new RegExp(modelIds[1]), {
        selector: '#ml-final-' + modelIds[1],
      }),
    )
    await user.click(screen.getByLabelText(/consumes the reserved tail/))
    await user.click(screen.getByTestId('ml-filter-evaluate-submit'))
    expect(await screen.findByTestId('ml-filter-evaluation-error')).toHaveTextContent(
      /already consumed/,
    )
    expect(screen.getByTestId('ml-filter-frozen-selection')).toHaveTextContent('rejected')
    expect(screen.queryByTestId('ml-filter-evaluate-submit')).not.toBeInTheDocument()
  })

  it('shows a failed evaluation job with the server message', async () => {
    const { datasetId } = trainMockModels()
    server.use(
      http.get('*/api/v1/ml-filters/evaluations/:jobId', ({ params }) =>
        HttpResponse.json({
          job_id: String(params.jobId),
          status: 'failed',
          error: { code: 'artifact_unavailable', message: 'Model artifact is missing.' },
        }),
      ),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<Harness datasetId={datasetId} />)
    await user.click(await screen.findByLabelText(/consumes the reserved tail/))
    await user.click(screen.getByTestId('ml-filter-evaluate-submit'))
    await settle(1_000)
    expect(await screen.findByTestId('ml-filter-evaluation-failed')).toHaveTextContent(
      'Model artifact is missing.',
    )
  })
})
