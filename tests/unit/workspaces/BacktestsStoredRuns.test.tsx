import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { handlers, resetMockBacktestDeletes } from '@/mocks/handlers'
import { useAppStore } from '@/store/useAppStore'
import { BacktestsWorkspace } from '@/workspaces/backtests/BacktestsWorkspace'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)
const JOB_PATH = /\/api\/v1\/backtest(\/|$)/
let jobRequests: string[] = []

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url)
    if (JOB_PATH.test(pathname)) jobRequests.push(`${request.method} ${pathname}`)
  })
})

beforeEach(() => {
  jobRequests = []
  useAppStore.getState().patchBacktestSession({
    workflowMode: 'backtest',
    runId: null,
    storedRunId: null,
    lastRequest: null,
    focus: 'setup',
    rightPanelTab: 'history',
    selectedHistoryRunId: null,
    comparisonRuns: null,
  })
})

afterEach(() => {
  server.resetHandlers()
  resetMockBacktestDeletes()
})

afterAll(() => server.close())

describe('BacktestsWorkspace stored runs', () => {
  it('opens a completed stack run into the full results view without a job request', async () => {
    const user = userEvent.setup()
    useAppStore.getState().patchBacktestSession({ selectedHistoryRunId: 'run-win-ma' })

    renderWithQueryClient(<BacktestsWorkspace />)

    await user.click(await screen.findByRole('button', { name: 'Open results' }))

    expect(await screen.findByRole('button', { name: 'Trade Chart' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Performance' })).toBeInTheDocument()
    expect(screen.getByText(/Stored run/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trade List' }))
    expect(await screen.findByText('Trade History')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Monthly' }))
    expect(await screen.findByText('Monthly Breakdown')).toBeInTheDocument()

    expect(jobRequests).toEqual(['GET /api/v1/backtest/run-win-ma/result'])
  })

  it('says a script run has no stored result and offers no action', async () => {
    const user = userEvent.setup()
    useAppStore.getState().patchBacktestSession({ selectedHistoryRunId: 'run-script-missing' })

    renderWithQueryClient(<BacktestsWorkspace />)

    await user.click(await screen.findByRole('button', { name: 'Open results' }))

    expect(
      await screen.findByText(/stored result for this script run is missing/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Re-run simulation/i })).not.toBeInTheDocument()
    expect(jobRequests).toEqual(['GET /api/v1/backtest/run-script-missing/result'])
  })

  it('says a stack run result is no longer stored and re-runs on request', async () => {
    const user = userEvent.setup()
    useAppStore.getState().patchBacktestSession({ selectedHistoryRunId: 'run-stack-missing' })

    renderWithQueryClient(<BacktestsWorkspace />)

    await user.click(await screen.findByRole('button', { name: 'Open results' }))

    expect(await screen.findByText(/no longer stored/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Re-run simulation/i }))

    await waitFor(() => {
      expect(jobRequests).toContain('POST /api/v1/backtest')
    })
  })

  it('refuses to open a stored run while a simulation is pending', async () => {
    server.use(
      http.get('*/api/v1/backtest/:runId', ({ params }) =>
        HttpResponse.json({ run_id: params.runId, status: 'running', error: null }),
      ),
    )
    useAppStore.getState().patchBacktestSession({
      runId: 'job-pending',
      selectedHistoryRunId: 'run-win-ma',
    })

    renderWithQueryClient(<BacktestsWorkspace />)

    expect(await screen.findByRole('button', { name: 'Open results' })).toBeDisabled()
    expect(screen.getByText(/A simulation is running/i)).toBeInTheDocument()
  })

  it('offers ML filter training for a stack run but not for a script run', async () => {
    const user = userEvent.setup()
    useAppStore.getState().patchBacktestSession({ selectedHistoryRunId: 'run-win-ma' })

    const { unmount } = renderWithQueryClient(<BacktestsWorkspace />)
    await user.click(await screen.findByRole('button', { name: 'Open results' }))
    expect(await screen.findByTestId('train-ml-filter')).toBeInTheDocument()
    unmount()

    useAppStore.getState().patchBacktestSession({
      storedRunId: null,
      rightPanelTab: 'history',
      selectedHistoryRunId: 'run-script-ma',
    })
    renderWithQueryClient(<BacktestsWorkspace />)
    await user.click(await screen.findByRole('button', { name: 'Open results' }))
    expect(await screen.findByRole('button', { name: 'Trade List' })).toBeInTheDocument()
    expect(screen.queryByTestId('train-ml-filter')).not.toBeInTheDocument()
  })
})
