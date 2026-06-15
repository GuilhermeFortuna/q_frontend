import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { handlers } from '@/mocks/handlers'
import { useAppStore } from '@/store/useAppStore'
import { OptimizeWorkspace } from '@/workspaces/optimize/OptimizeWorkspace'
import { renderWithQueryClient } from '../testUtils'
import type { OptimizationConfig } from '@/types/optimization'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  useAppStore.getState().patchOptimizeSession({
    studyId: null,
    studyBacktestConfigs: {},
    submittedConfig: null,
    focus: 'setup',
    rightPanelTab: 'results',
    selectedHistoryStudyId: null,
  })
  useAppStore.getState().setPendingOptimizationConfig(null)
})
afterAll(() => server.close())

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return { ...actual, fetchOhlcvAvailableRange: vi.fn() }
})

async function waitForStrategyLibrary() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /MA Crossover/i, pressed: true })).toBeInTheDocument()
  })
}

function immediateOptimizeHandlers() {
  let studyId = 'test-study-1'
  let lastConfig: OptimizationConfig | null = null

  server.use(
    http.post('*/api/v1/optimize', async ({ request }) => {
      lastConfig = (await request.json()) as OptimizationConfig
      studyId = `test-study-${Date.now()}`
      return HttpResponse.json({ study_id: studyId, status: 'done' })
    }),
    http.get('*/api/v1/optimize/:study_id', () =>
      HttpResponse.json({
        study_id: studyId,
        status: 'done',
        completed_trials: 30,
        n_trials: 30,
        best_value: 1.2345,
        best_params: { short_period: 12, long_period: 35 },
        error: null,
      }),
    ),
    http.get('*/api/v1/optimize/:study_id/results', () =>
      HttpResponse.json({
        study_id: studyId,
        objective_mode: lastConfig?.objective.mode ?? 'maximize_return_drawdown',
        is_multi_objective: false,
        best_params: { short_period: 12, long_period: 35, quantity: 1.5 },
        best_trial: {
          number: 1,
          state: 'COMPLETE',
          values: [1.2345],
          params: { short_period: 12, long_period: 35, quantity: 1.5 },
          user_attrs: { status: 'complete' },
        },
        trials: [
          {
            number: 1,
            state: 'COMPLETE',
            values: [1.2345],
            params: { short_period: 12, long_period: 35, quantity: 1.5 },
            user_attrs: { status: 'complete' },
          },
        ],
        pareto_trials: [],
        failures: [],
      }),
    ),
  )
}

describe('OptimizeWorkspace — focus swap', () => {
  it('submits a study and lands focus on expanded results', async () => {
    immediateOptimizeHandlers()
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeWorkspace />)
    await waitForStrategyLibrary()

    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    await waitFor(() => {
      expect(screen.getByText('Best Objective')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
  })

  it('expands setup from the collapsed strip and preserves form state', async () => {
    immediateOptimizeHandlers()
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeWorkspace />)
    await waitForStrategyLibrary()

    const symbolInput = screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement
    await user.clear(symbolInput)
    await user.type(symbolInput, 'VALE3')
    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Expand setup' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Optimization' })).toBeInTheDocument()
    })
    expect((screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement).value).toBe('VALE3')
  })

  it('returns to results from the collapsed teaser without restarting the study', async () => {
    immediateOptimizeHandlers()
    const user = userEvent.setup()
    let startCalls = 0

    server.use(
      http.post('*/api/v1/optimize', async () => {
        startCalls += 1
        return HttpResponse.json({ study_id: `test-study-${startCalls}`, status: 'done' })
      }),
      http.get('*/api/v1/optimize/:study_id', ({ params }) =>
        HttpResponse.json({
          study_id: params.study_id,
          status: 'done',
          completed_trials: 30,
          n_trials: 30,
          best_value: 1.2345,
          best_params: {},
          error: null,
        }),
      ),
      http.get('*/api/v1/optimize/:study_id/results', ({ params }) =>
        HttpResponse.json({
          study_id: params.study_id,
          objective_mode: 'maximize_return_drawdown',
          is_multi_objective: false,
          best_params: {},
          best_trial: {
            number: 1,
            state: 'COMPLETE',
            values: [1.2345],
            params: {},
            user_attrs: { status: 'complete' },
          },
          trials: [
            {
              number: 1,
              state: 'COMPLETE',
              values: [1.2345],
              params: {},
              user_attrs: { status: 'complete' },
            },
          ],
          pareto_trials: [],
          failures: [],
        }),
      ),
    )

    renderWithQueryClient(<OptimizeWorkspace />)
    await waitForStrategyLibrary()
    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    await waitFor(() => {
      expect(screen.getByText('Best Objective')).toBeInTheDocument()
    })
    expect(startCalls).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Expand setup' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Optimization' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Expand results' }))

    await waitFor(() => {
      expect(screen.getByText('Best Objective')).toBeInTheDocument()
    })
    expect(startCalls).toBe(1)
  })

  it('re-runs from the collapsed setup strip without expanding setup', async () => {
    immediateOptimizeHandlers()
    const user = userEvent.setup()
    let startCalls = 0

    server.use(
      http.post('*/api/v1/optimize', async () => {
        startCalls += 1
        return HttpResponse.json({ study_id: `test-study-${startCalls}`, status: 'done' })
      }),
      http.get('*/api/v1/optimize/:study_id', ({ params }) =>
        HttpResponse.json({
          study_id: params.study_id,
          status: 'done',
          completed_trials: 30,
          n_trials: 30,
          best_value: 1.2345,
          best_params: {},
          error: null,
        }),
      ),
      http.get('*/api/v1/optimize/:study_id/results', ({ params }) =>
        HttpResponse.json({
          study_id: params.study_id,
          objective_mode: 'maximize_return_drawdown',
          is_multi_objective: false,
          best_params: {},
          best_trial: {
            number: 1,
            state: 'COMPLETE',
            values: [1.2345],
            params: {},
            user_attrs: { status: 'complete' },
          },
          trials: [
            {
              number: 1,
              state: 'COMPLETE',
              values: [1.2345],
              params: {},
              user_attrs: { status: 'complete' },
            },
          ],
          pareto_trials: [],
          failures: [],
        }),
      ),
    )

    renderWithQueryClient(<OptimizeWorkspace />)
    await waitForStrategyLibrary()
    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Run optimization with current setup' }))

    await waitFor(() => {
      expect(startCalls).toBe(2)
    })
    expect(screen.getByRole('button', { name: 'Expand setup' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run Optimization' })).not.toBeInTheDocument()
  })

  it('routes the pre-run results teaser to history', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeWorkspace />)
    await waitForStrategyLibrary()

    await user.click(screen.getByRole('button', { name: 'Open optimization history' }))

    await waitFor(() => {
      expect(screen.getByText('Past Studies')).toBeInTheDocument()
    })
  })
})

describe('CollapsedOptimizeResultsTeaser', () => {
  it('shows headline metrics after a completed study', async () => {
    immediateOptimizeHandlers()
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeWorkspace />)
    await waitForStrategyLibrary()
    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    await waitFor(() => {
      expect(screen.getByText('Best Objective')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Expand setup' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand results' })).toBeInTheDocument()
    })

    const resultsTeaser = screen.getByRole('button', { name: 'Expand results' })
    expect(within(resultsTeaser).getByText('Best objective')).toBeInTheDocument()
    expect(within(resultsTeaser).getByText('Completed')).toBeInTheDocument()
  })
})
