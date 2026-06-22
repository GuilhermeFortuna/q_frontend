import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { LeaderboardTable } from '@/components/discover/LeaderboardTable'
import { handlers, resetMockStrategySearchDeletes } from '@/mocks/handlers'
import { mockStrategySearchResults } from '@/mocks/strategySearch'
import { useAppStore } from '@/store/useAppStore'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockStrategySearchDeletes()
  useAppStore.setState({ pendingBacktestConfig: null, pendingOptimizationConfig: null })
})
afterAll(() => server.close())

const results = mockStrategySearchResults['ss-run-petr4']
const backtest = results.search_config!.backtest

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

describe('LeaderboardTable', () => {
  it('renders OOS-ranked rows with gated candidates de-emphasized', () => {
    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-petr4"
        candidates={results.candidates}
        objectiveMode={results.objective_mode}
        backtest={backtest}
        searchConfig={results.search_config}
      />,
    )

    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThan(1)
    expect(screen.getAllByText('MACrossover').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('RSIMeanReversion')).toBeInTheDocument()
    expect(screen.getByText('Flagged')).toBeInTheDocument()
    expect(screen.getByText('unsupported')).toBeInTheDocument()
  })

  it('shows gate badge title with flags on hover', () => {
    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-petr4"
        candidates={results.candidates}
        objectiveMode={results.objective_mode}
        backtest={backtest}
        searchConfig={results.search_config}
      />,
    )

    expect(screen.getByTitle(/Low IS→OOS efficiency/i)).toBeInTheDocument()
  })

  it('fires per-candidate equity query on row expansion', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-petr4"
        candidates={results.candidates}
        objectiveMode={results.objective_mode}
        backtest={backtest}
        searchConfig={results.search_config}
      />,
    )

    await user.click(screen.getAllByRole('button', { name: /MACrossover/i })[0]!)

    await waitFor(() => {
      const queries = queryClient.getQueryCache().findAll({
        queryKey: ['strategySearch', 'artifacts', 'equity', 'ss-run-petr4', 'MACrossover'],
      })
      expect(queries.length).toBe(1)
    })
  })

  it('Send to Backtest sets pendingBacktestConfig with candidate strategy and params', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-petr4"
        candidates={results.candidates}
        objectiveMode={results.objective_mode}
        backtest={backtest}
        searchConfig={results.search_config}
      />,
    )

    const promoteButtons = screen.getAllByRole('button', { name: 'Send to Backtest' })
    await user.click(promoteButtons[0]!)

    const pending = useAppStore.getState().pendingBacktestConfig
    expect(pending?.strategy).toBe('MACrossover')
    expect(pending?.strategy_params).toEqual({ short_period: 8, long_period: 21 })
  })

  it('renders compact exit tag for exit-expanded candidates', () => {
    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-petr4"
        candidates={results.candidates}
        objectiveMode={results.objective_mode}
        backtest={backtest}
        searchConfig={results.search_config}
      />,
    )

    expect(screen.getByTitle('Exit: Chandelier trail')).toBeInTheDocument()
  })

  it('still renders candidates without exit metadata', () => {
    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-petr4"
        candidates={results.candidates}
        objectiveMode={results.objective_mode}
        backtest={backtest}
        searchConfig={results.search_config}
      />,
    )

    expect(screen.getAllByText('MACrossover').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('VMA')).toBeInTheDocument()
    expect(screen.getByTitle('Exit: Chandelier trail')).toBeInTheDocument()
  })
})
