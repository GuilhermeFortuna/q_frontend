import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { LeaderboardTable } from '@/components/discover/LeaderboardTable'
import { handlers, resetMockStrategySearchDeletes } from '@/mocks/handlers'
import { mockStrategySearchResults } from '@/mocks/strategySearch'
import { useAppStore } from '@/store/useAppStore'
import type { CandidateResult } from '@/types/strategySearch'
import { VIRTUALIZE_THRESHOLD } from '@/lib/virtualization/constants'
import { renderWithQueryClient } from '../testUtils'

vi.mock('@tanstack/react-virtual', () => {
  const useVirtualizer = vi.fn(() => ({
    getTotalSize: () => 56 * 5,
    getVirtualItems: () =>
      Array.from({ length: 5 }, (_, index) => ({
        key: index,
        index,
        start: index * 56,
        end: (index + 1) * 56,
        size: 56,
      })),
    measureElement: vi.fn(),
    measure: vi.fn(),
  }))
  return { useVirtualizer }
})

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
const geneticResults = mockStrategySearchResults['ss-run-genetic']

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

function renderLeaderboard(candidates: CandidateResult[] = results.candidates) {
  return renderWithQueryClient(
    <LeaderboardTable
      runId="ss-run-petr4"
      candidates={candidates}
      objectiveMode={results.objective_mode}
      backtest={backtest}
      searchConfig={results.search_config}
    />,
  )
}

function rowForStrategy(strategyName: string): HTMLElement {
  const button = screen.getAllByRole('button', { name: new RegExp(`^${strategyName}`, 'i') })[0]!
  return button.closest('tr')!
}

describe('LeaderboardTable', () => {
  it('renders OOS-ranked rows with gated candidates de-emphasized', () => {
    renderLeaderboard()

    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThan(1)
    expect(screen.getAllByText('MACrossover').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('RSIMeanReversion')).toBeInTheDocument()
    expect(screen.getByText('Flagged')).toBeInTheDocument()
    expect(screen.getByText('unsupported')).toBeInTheDocument()
  })

  it('renders Entry and Exit column headers instead of Strategy', () => {
    renderLeaderboard()

    expect(screen.getByRole('columnheader', { name: /Entry/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /^Exit$/i })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /^Strategy$/i })).not.toBeInTheDocument()
  })

  it('shows exit preset label in the Exit cell and removes the inline Exit chip', () => {
    renderLeaderboard()

    const exitRow = screen.getByText('Chandelier trail').closest('tr')!
    expect(within(exitRow).getByRole('button', { name: /MACrossover/i })).toBeInTheDocument()
    expect(screen.queryByText(/^Exit: Chandelier trail$/i)).not.toBeInTheDocument()
  })

  it('shows exit policy label when preset is absent', () => {
    const policyOnlyCandidate: CandidateResult = {
      ...results.candidates[0]!,
      candidate_id: 'policy-only',
      exit_preset_label: null,
      exit_policy_label: 'Fixed stop only',
    }

    renderLeaderboard([policyOnlyCandidate])

    const row = rowForStrategy('MACrossover')
    expect(within(row).getByText('Fixed stop only')).toBeInTheDocument()
  })

  it('shows muted Signal exit for entry-only candidates', () => {
    renderLeaderboard()

    const entryOnlyRow = rowForStrategy('VMA')
    const exitLabel = within(entryOnlyRow).getByText('Signal exit')
    expect(exitLabel).toHaveClass('text-silver-500')
    expect(exitLabel).toHaveAttribute(
      'title',
      "Closes on the strategy's own signal — no stop/target overlay.",
    )
  })

  it('shows gate badge title with flags on hover', () => {
    renderLeaderboard()

    expect(screen.getByTitle(/Low IS→OOS efficiency/i)).toBeInTheDocument()
  })

  it('fires per-candidate equity query when the morphing inspector opens', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderLeaderboard()

    await user.click(screen.getAllByRole('button', { name: /MACrossover/i })[0]!)
    expect(await screen.findByTestId('morphing-dialog-content')).toBeInTheDocument()

    await waitFor(() => {
      const queries = queryClient.getQueryCache().findAll({
        queryKey: ['strategySearch', 'artifacts', 'equity', 'ss-run-petr4', 'MACrossover'],
      })
      expect(queries.length).toBe(1)
    })
  })

  it('opens CandidateDetailPanel in the morphing dialog, not an expanded table row', async () => {
    const user = userEvent.setup()
    renderLeaderboard()

    const exitRowButton = screen.getByText('Chandelier trail').closest('tr')!
    await user.click(within(exitRowButton).getByRole('button', { name: /MACrossover/i }))

    await waitFor(() => {
      expect(screen.getByText('Exit policy')).toBeInTheDocument()
    })

    expect(screen.getByTestId('morphing-dialog-content')).toBeInTheDocument()
    expect(screen.getByText('Exit policy').closest('td')).toBeNull()
  })

  it('does not open the inspector when promote actions are clicked', async () => {
    const user = userEvent.setup()
    renderLeaderboard()

    await user.click(screen.getAllByRole('button', { name: 'Send to Backtest' })[0]!)
    expect(screen.queryByTestId('morphing-dialog-content')).not.toBeInTheDocument()
  })

  it('opens from row click outside the Entry control', async () => {
    const user = userEvent.setup()
    renderLeaderboard()

    const row = rowForStrategy('VMA')
    const rankCell = within(row).getAllByRole('cell')[0]!
    await user.click(rankCell)

    expect(await screen.findByTestId('morphing-dialog-content')).toBeInTheDocument()
  })

  it('falls back focus to the table when the origin row is filtered away', async () => {
    const user = userEvent.setup()
    const geneticBacktest = geneticResults.search_config!.backtest

    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-genetic"
        candidates={geneticResults.candidates}
        objectiveMode={geneticResults.objective_mode}
        backtest={geneticBacktest}
        searchConfig={geneticResults.search_config}
      />,
    )

    await user.click(screen.getByRole('button', { name: /CompositeStrategy/i }))
    expect(await screen.findByTestId('morphing-dialog-content')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Generation/i), '4')

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByTestId('morphing-dialog-content')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('leaderboard-table')).toHaveFocus()
  })

  it('Send to Backtest sets pendingBacktestConfig with candidate strategy and params', async () => {
    const user = userEvent.setup()
    renderLeaderboard()

    const promoteButtons = screen.getAllByRole('button', { name: 'Send to Backtest' })
    await user.click(promoteButtons[0]!)

    const pending = useAppStore.getState().pendingBacktestConfig
    expect(pending?.strategy).toBe('MACrossover')
    expect(pending?.strategy_params).toEqual({ short_period: 8, long_period: 21 })

    const backtestSession = useAppStore.getState().backtestSession
    expect(backtestSession.workflowMode).toBe('backtest')
    expect(backtestSession.focus).toBe('setup')
    expect(backtestSession.rightPanelTab).toBe('results')
  })

  it('Send to Optimizer sets pendingOptimizationConfig and updates sessions state', async () => {
    const user = userEvent.setup()
    renderLeaderboard()

    const promoteButtons = screen.getAllByRole('button', { name: 'Send to Optimizer' })
    await user.click(promoteButtons[0]!)

    const pending = useAppStore.getState().pendingOptimizationConfig
    expect(pending?.backtest?.strategy).toBe('MACrossover')

    const backtestSession = useAppStore.getState().backtestSession
    expect(backtestSession.workflowMode).toBe('optimize')

    const optimizeSession = useAppStore.getState().optimizeSession
    expect(optimizeSession.focus).toBe('setup')
    expect(optimizeSession.rightPanelTab).toBe('results')
  })

  it('virtualizes large leaderboards and keeps fixed row height when opening the inspector', async () => {
    const user = userEvent.setup()
    const template =
      results.candidates.find((c) => c.exit_preset_label === 'Chandelier trail') ??
      results.candidates[0]!
    const manyCandidates = Array.from({ length: VIRTUALIZE_THRESHOLD + 15 }, (_, index) => ({
      ...template,
      candidate_id: `candidate-${index}`,
      strategy: `Strategy${index}`,
      rank: index + 1,
      objective_value: 1.5 - index * 0.01,
    }))
    const { container } = renderLeaderboard(manyCandidates)

    expect(container.querySelector('[data-virtualized="true"]')).toBeTruthy()
    expect(container.querySelectorAll('table')).toHaveLength(1)
    expect(container.querySelectorAll('tbody table')).toHaveLength(0)

    const bodyRowsBefore = container.querySelectorAll('tbody tr')
    expect(bodyRowsBefore.length).toBeLessThan(20)
    expect(bodyRowsBefore.length).toBeGreaterThan(0)
    const rowCountBefore = bodyRowsBefore.length

    await user.click(screen.getByRole('button', { name: /Strategy0/i }))

    await waitFor(() => {
      expect(screen.getByText('Exit policy')).toBeInTheDocument()
    })

    expect(screen.getByTestId('morphing-dialog-content')).toBeInTheDocument()
    expect(screen.getByText('Exit policy').closest('td')).toBeNull()
    expect(container.querySelectorAll('tbody tr').length).toBe(rowCountBefore)
  })
})
