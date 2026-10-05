import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { useState } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MLFilterComparison } from '@/components/research/ml-filters/MLFilterComparison'
import { handlers } from '@/mocks/handlers'
import { MOCK_ML_CONSUMED_DATASET_ID, resetMockMlFilterState } from '@/mocks/mlFilters'
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

function Harness({ datasetId }: { datasetId: string | null }) {
  const [jobId, setJobId] = useState<string | null>(null)
  return <MLFilterComparison datasetId={datasetId} jobId={jobId} onJobStarted={setJobId} />
}

async function settle(ms = 3_000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('MLFilterComparison', () => {
  it('asks for a dataset before offering a comparison', () => {
    renderWithQueryClient(<Harness datasetId={null} />)
    expect(screen.getByTestId('ml-filter-comparison-empty')).toBeInTheDocument()
  })

  it('compares versions of one dataset with candidate counts separate from trade counts', async () => {
    const { datasetId } = trainMockModels()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<Harness datasetId={datasetId} />)
    await user.click(await screen.findByTestId('ml-filter-compare-submit'))
    await settle()
    const table = await screen.findByTestId('ml-filter-comparison-table')
    expect(within(table).getByRole('columnheader', { name: 'Trades' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Candidates' })).toBeInTheDocument()
    const baseline = within(table).getByTestId('ml-filter-baseline-row')
    expect(baseline).toHaveTextContent('Unfiltered MA Crossover')
    expect(baseline).toHaveTextContent('1,840.50')
    expect(baseline).toHaveTextContent('-920.25')
    expect(baseline).toHaveTextContent('1.18')
    const rows = within(table).getAllByTestId('ml-filter-comparison-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('0.50')
    expect(rows[0]).toHaveTextContent('Scored 120')
    expect(screen.getByTestId('ml-filter-classification-table')).toBeInTheDocument()
  })

  it('shows undefined metrics as unavailable with the server reason, never zero', async () => {
    const { datasetId } = trainMockModels()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<Harness datasetId={datasetId} />)
    await user.click(await screen.findByTestId('ml-filter-compare-submit'))
    await settle()
    expect(await screen.findAllByText('Unavailable')).not.toHaveLength(0)
    expect(screen.getByText('Validation labels contain a single class.')).toBeInTheDocument()
    expect(
      screen.getByText('No losing trades after filtering; profit factor is undefined.'),
    ).toBeInTheDocument()
  })

  it('keeps the threshold that produced results when the editor changes', async () => {
    const { datasetId } = trainMockModels()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<Harness datasetId={datasetId} />)
    await user.click(await screen.findByTestId('ml-filter-compare-submit'))
    await settle()
    await screen.findByTestId('ml-filter-comparison-table')

    const input = screen.getByLabelText('Acceptance threshold')
    fireEvent.change(input, { target: { value: '0.7' } })
    fireEvent.blur(input)
    expect(await screen.findByTestId('ml-filter-stale-threshold')).toHaveTextContent(
      'used threshold 0.50',
    )
    for (const row of screen.getAllByTestId('ml-filter-comparison-row')) {
      expect(row).toHaveTextContent('0.50')
    }

    await user.click(screen.getByTestId('ml-filter-compare-submit'))
    await settle()
    await waitFor(() => {
      for (const row of screen.getAllByTestId('ml-filter-comparison-row')) {
        expect(row).toHaveTextContent('0.70')
      }
    })
    expect(screen.queryByTestId('ml-filter-stale-threshold')).not.toBeInTheDocument()
  })

  it('rejects out-of-range thresholds before submission', async () => {
    const { datasetId } = trainMockModels()
    renderWithQueryClient(<Harness datasetId={datasetId} />)
    const input = await screen.findByLabelText('Acceptance threshold')
    fireEvent.change(input, { target: { value: '1.5' } })
    fireEvent.blur(input)
    expect(await screen.findByText('Threshold must be between 0 and 1.')).toBeInTheDocument()
    expect(screen.getByTestId('ml-filter-compare-submit')).toBeDisabled()
  })

  it('cannot compare a dataset without ready (compatible) versions', async () => {
    renderWithQueryClient(<Harness datasetId={MOCK_ML_CONSUMED_DATASET_ID} />)
    expect(await screen.findByText(/No ready model versions/)).toBeInTheDocument()
    expect(screen.getByTestId('ml-filter-compare-submit')).toBeDisabled()
  })

  it('surfaces a failed comparison job', async () => {
    const { datasetId } = trainMockModels()
    server.use(
      http.get('*/api/v1/ml-filters/comparisons/:jobId', ({ params }) =>
        HttpResponse.json({
          job_id: String(params.jobId),
          status: 'failed',
          error: { code: 'incompatible_model', message: 'Artifact missing for one model.' },
        }),
      ),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQueryClient(<Harness datasetId={datasetId} />)
    await user.click(await screen.findByTestId('ml-filter-compare-submit'))
    await settle(1_000)
    expect(await screen.findByTestId('ml-filter-compare-failed')).toHaveTextContent(
      'Artifact missing for one model.',
    )
  })
})
