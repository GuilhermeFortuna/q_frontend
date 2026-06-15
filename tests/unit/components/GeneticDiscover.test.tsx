import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CandidateDetailPanel } from '@/components/discover/CandidateDetailPanel'
import { DiscoverProgress } from '@/components/discover/DiscoverProgress'
import { GeneticVerdictPanel } from '@/components/discover/GeneticVerdictPanel'
import { LeaderboardTable } from '@/components/discover/LeaderboardTable'
import { handlers, resetMockStrategySearchDeletes } from '@/mocks/handlers'
import { mockStrategySearchResults, mockStrategySearchStatuses } from '@/mocks/strategySearch'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockStrategySearchDeletes()
})
afterAll(() => server.close())

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

describe('DiscoverProgress genetic', () => {
  it('renders generation progress when total_generations is present', () => {
    render(
      <DiscoverProgress
        status={{
          ...mockStrategySearchStatuses['ss-run-genetic'],
          status: 'running',
          current_candidate: 7,
        }}
        onCancel={vi.fn()}
        cancelling={false}
      />,
    )

    expect(screen.getByText(/Generation 5 \/ 5/i)).toBeInTheDocument()
    expect(screen.getByText(/Candidates: 7 \/ 40/i)).toBeInTheDocument()
  })

  it('does not render generation bar for registry runs', () => {
    render(
      <DiscoverProgress
        status={{
          run_id: 'ss-1',
          status: 'running',
          current_candidate: 3,
          total_candidates: 9,
          candidate_id: 'RSIMeanReversion',
          strategy: 'RSIMeanReversion',
          phase: 'testing',
          window_index: 1,
          total_windows: 4,
          error: null,
        }}
        onCancel={vi.fn()}
        cancelling={false}
      />,
    )

    expect(screen.queryByText(/Generation/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Candidates: 3 \/ 9/i)).toBeInTheDocument()
  })
})

describe('GeneticVerdictPanel', () => {
  it('shows DSR and lock-box pass state', () => {
    const results = mockStrategySearchResults['ss-run-genetic']
    render(<GeneticVerdictPanel summary={results.summary} best={results.best} />)

    expect(screen.getAllByText(/DSR 62%/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Lock-box passed/i)).toBeInTheDocument()
    expect(screen.getByText(/screening, not proof/i)).toBeInTheDocument()
  })

  it('shows red divergence when lock-box fails', () => {
    const results = mockStrategySearchResults['ss-run-genetic']
    render(
      <GeneticVerdictPanel
        summary={{
          ...results.summary,
          lockbox_passed: false,
          lockbox_metrics: { sharpe_ratio: -0.1, total_trades: 2 },
        }}
        best={results.best}
      />,
    )

    expect(screen.getByText(/Lock-box failed/i)).toBeInTheDocument()
  })
})

describe('LeaderboardTable genetic', () => {
  const results = mockStrategySearchResults['ss-run-genetic']
  const backtest = results.search_config!.backtest

  it('shows generation filter and Evolved badge', () => {
    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-genetic"
        candidates={results.candidates}
        objectiveMode={results.objective_mode}
        backtest={backtest}
        searchConfig={results.search_config}
      />,
    )

    expect(screen.getByText('Evolved')).toBeInTheDocument()
    expect(screen.getByText('Generation 5')).toBeInTheDocument()
  })

  it('filters rows by generation', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-genetic"
        candidates={results.candidates}
        objectiveMode={results.objective_mode}
        backtest={backtest}
        searchConfig={results.search_config}
      />,
    )

    await user.selectOptions(screen.getByLabelText(/Generation/i), '4')

    expect(screen.queryByText('genome-champion-001')).not.toBeInTheDocument()
    expect(screen.getByText(/CompositeStrategy/)).toBeInTheDocument()
  })

  it('registry run has no generation filter', () => {
    const registry = mockStrategySearchResults['ss-run-petr4']
    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-petr4"
        candidates={registry.candidates}
        objectiveMode={registry.objective_mode}
        backtest={registry.search_config!.backtest}
        searchConfig={registry.search_config}
      />,
    )

    expect(screen.queryByText('Evolved')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Generation/i)).not.toBeInTheDocument()
  })
})

describe('CandidateDetailPanel genetic', () => {
  const results = mockStrategySearchResults['ss-run-genetic']
  const backtest = results.search_config!.backtest

  it('shows Genome tab with inline genome tree', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(
      <CandidateDetailPanel
        runId="ss-run-genetic"
        candidate={results.candidates[0]!}
        backtest={backtest}
        objectiveMode={results.objective_mode}
        searchConfig={results.search_config}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Genome' }))
    expect(screen.getByText('genome-champion-001')).toBeInTheDocument()
    expect(screen.getByText('CrossAbove')).toBeInTheDocument()
  })

  it('lazy-fetches genome when inline genome is absent', async () => {
    const user = userEvent.setup()
    const candidate = results.candidates[2]!
    const { queryClient } = renderWithQueryClient(
      <CandidateDetailPanel
        runId="ss-run-genetic"
        candidate={candidate}
        backtest={backtest}
        objectiveMode={results.objective_mode}
        searchConfig={results.search_config}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Genome' }))

    await waitFor(() => {
      const queries = queryClient.getQueryCache().findAll({
        queryKey: [
          'strategySearch',
          'artifacts',
          'genome',
          'ss-run-genetic',
          candidate.candidate_id,
        ],
      })
      expect(queries.length).toBe(1)
    })

    await waitFor(() => {
      expect(screen.getByText('genome-gen3-003')).toBeInTheDocument()
    })
  })

  it('registry candidate has no Genome tab', () => {
    const registry = mockStrategySearchResults['ss-run-petr4']
    renderWithQueryClient(
      <CandidateDetailPanel
        runId="ss-run-petr4"
        candidate={registry.candidates[0]!}
        backtest={registry.search_config!.backtest}
        objectiveMode={registry.objective_mode}
        searchConfig={registry.search_config}
      />,
    )

    expect(screen.queryByRole('tab', { name: 'Genome' })).not.toBeInTheDocument()
  })
})

describe('pre-WO40 degrade path', () => {
  it('renders registry leaderboard without genetic UI', () => {
    const registry = mockStrategySearchResults['ss-run-petr4']
    renderWithQueryClient(
      <LeaderboardTable
        runId="ss-run-petr4"
        candidates={registry.candidates}
        objectiveMode={registry.objective_mode}
        backtest={registry.search_config!.backtest}
        searchConfig={registry.search_config}
      />,
    )

    expect(screen.getByText('MACrossover')).toBeInTheDocument()
    expect(screen.queryByText(/Overfitting defense/i)).not.toBeInTheDocument()
  })
})
