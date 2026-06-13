import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { getMockBacktestResponse } from '@/mocks/backtest'
import { handlers } from '@/mocks/handlers'
import { useAppStore } from '@/store/useAppStore'
import { BacktestsWorkspace } from '@/workspaces/backtests/BacktestsWorkspace'
import { renderWithQueryClient } from '../testUtils'
import type { BacktestRequest } from '@/types/backtesting'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  // Backtests now persist the active run id across navigation; clear it and other session
  // state so they don't leak from one test to the next.
  useAppStore.getState().patchBacktestSession({
    runId: null,
    lastCapital: 100000,
    lastRequest: null,
    focus: 'setup',
    rightPanelTab: 'results',
    selectedHistoryRunId: null,
    comparisonRuns: null,
  })
})
afterAll(() => server.close())

async function waitForStrategyLibrary() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /MA Crossover/i, pressed: true })).toBeInTheDocument()
  })
}

describe('BacktestsWorkspace — focus swap', () => {
  it('submits a run and lands focus on expanded results', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<BacktestsWorkspace />)
    await waitForStrategyLibrary()

    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    await waitFor(() => {
      expect(screen.getByText('Performance')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
  })

  it('expands setup from the collapsed strip and preserves form state', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<BacktestsWorkspace />)
    await waitForStrategyLibrary()

    const symbolInput = screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement
    await user.clear(symbolInput)
    await user.type(symbolInput, 'VALE3')
    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Expand setup' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Simulation' })).toBeInTheDocument()
    })
    expect((screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement).value).toBe('VALE3')
  })

  it('returns to results from the collapsed teaser without refetching', async () => {
    const user = userEvent.setup()
    let runCalls = 0
    let lastBody: BacktestRequest | null = null

    // Count dispatches against the async endpoint; status/result resolve immediately.
    server.use(
      http.post('*/api/v1/backtest', async ({ request }) => {
        runCalls += 1
        lastBody = (await request.json()) as BacktestRequest
        return HttpResponse.json({ run_id: `test-run-${runCalls}`, status: 'running' })
      }),
      http.get('*/api/v1/backtest/:runId/result', ({ params }) =>
        HttpResponse.json({
          ...getMockBacktestResponse(lastBody as BacktestRequest),
          run_id: params.runId,
        }),
      ),
      http.get('*/api/v1/backtest/:runId', ({ params }) =>
        HttpResponse.json({ run_id: params.runId, status: 'completed', error: null }),
      ),
    )

    renderWithQueryClient(<BacktestsWorkspace />)
    await waitForStrategyLibrary()
    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    await waitFor(() => {
      expect(screen.getByText('Performance')).toBeInTheDocument()
    })
    expect(runCalls).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Expand setup' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Simulation' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Expand results' }))

    await waitFor(() => {
      expect(screen.getByText('Performance')).toBeInTheDocument()
    })
    expect(runCalls).toBe(1)
  })

  it('re-runs from the collapsed setup strip without expanding setup', async () => {
    const user = userEvent.setup()
    let runCalls = 0
    let lastBody: BacktestRequest | null = null

    // Count dispatches against the async endpoint; status/result resolve immediately.
    server.use(
      http.post('*/api/v1/backtest', async ({ request }) => {
        runCalls += 1
        lastBody = (await request.json()) as BacktestRequest
        return HttpResponse.json({ run_id: `test-run-${runCalls}`, status: 'running' })
      }),
      http.get('*/api/v1/backtest/:runId/result', ({ params }) =>
        HttpResponse.json({
          ...getMockBacktestResponse(lastBody as BacktestRequest),
          run_id: params.runId,
        }),
      ),
      http.get('*/api/v1/backtest/:runId', ({ params }) =>
        HttpResponse.json({ run_id: params.runId, status: 'completed', error: null }),
      ),
    )

    renderWithQueryClient(<BacktestsWorkspace />)
    await waitForStrategyLibrary()
    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Run simulation with current setup' }))

    await waitFor(() => {
      expect(runCalls).toBe(2)
    })
    expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run Simulation' })).not.toBeInTheDocument()
  })

  it('routes the pre-run results teaser to history', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<BacktestsWorkspace />)
    await waitForStrategyLibrary()

    await user.click(screen.getByRole('button', { name: 'Open backtest history' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
    })
  })

  it('updates the collapsed setup digest when params change while results are focused', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<BacktestsWorkspace />)
    await waitForStrategyLibrary()

    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
    })

    const setupTeaser = screen.getByRole('button', { name: 'Expand setup' })
    expect(setupTeaser.textContent).toMatch(/50\/200/)

    await user.click(setupTeaser)
    await waitFor(() => {
      expect(screen.getByLabelText('Short Period')).toBeInTheDocument()
    })

    const shortPeriod = screen.getByLabelText('Short Period')
    await user.clear(shortPeriod)
    await user.type(shortPeriod, '12')
    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Expand setup' }).textContent).toMatch(/12\/200/)
  })

  it('renders both focus states when reduced motion is preferred', async () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    renderWithQueryClient(<BacktestsWorkspace />)
    await waitForStrategyLibrary()

    expect(screen.getByRole('button', { name: 'Open backtest history' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Simulation' })).toBeInTheDocument()

    matchMedia.mockRestore()
  })
})

describe('CollapsedResultsTeaser', () => {
  it('shows headline metrics after a completed run', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<BacktestsWorkspace />)
    await waitForStrategyLibrary()
    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    await waitFor(() => {
      expect(screen.getByText('Performance')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Expand setup' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand results' })).toBeInTheDocument()
    })

    const resultsTeaser = screen.getByRole('button', { name: 'Expand results' })
    expect(within(resultsTeaser).getByText('Net profit')).toBeInTheDocument()
    expect(within(resultsTeaser).getByText('Win rate')).toBeInTheDocument()
  })
})
