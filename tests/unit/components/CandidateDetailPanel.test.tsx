import { screen, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { CandidateDetailPanel } from '@/components/discover/CandidateDetailPanel'
import { handlers, resetMockStrategySearchDeletes } from '@/mocks/handlers'
import { mockStrategySearchResults } from '@/mocks/strategySearch'
import type { CandidateResult } from '@/types/strategySearch'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockStrategySearchDeletes()
})
afterAll(() => server.close())

const results = mockStrategySearchResults['ss-run-petr4']
const backtest = results.search_config!.backtest

const baselineCandidate = results.candidates.find((c) => c.candidate_id === 'MACrossover')!

describe('CandidateDetailPanel exit insights', () => {
  it('renders exit preset label and reason distribution', async () => {
    const exitCandidate = results.candidates.find(
      (c) => c.candidate_id === 'MACrossover__exit_chandelier',
    )!

    renderWithQueryClient(
      <CandidateDetailPanel
        runId="ss-run-petr4"
        candidate={exitCandidate}
        backtest={backtest}
        objectiveMode={results.objective_mode}
        searchConfig={results.search_config}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Exit policy')).toBeInTheDocument()
    })

    expect(screen.getByText('Chandelier trail')).toBeInTheDocument()
    expect(screen.getByText('Exit distribution')).toBeInTheDocument()
    expect(screen.getByText('chandelier')).toBeInTheDocument()
    expect(screen.getByText('Path quality')).toBeInTheDocument()
    expect(screen.getByText('MFE captured')).toBeInTheDocument()
    expect(screen.getByText('47%')).toBeInTheDocument()
  })

  it('omits exit panel when metadata is missing', async () => {
    renderWithQueryClient(
      <CandidateDetailPanel
        runId="ss-run-petr4"
        candidate={baselineCandidate}
        backtest={backtest}
        objectiveMode={results.objective_mode}
        searchConfig={results.search_config}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText(/Loading OOS equity curve/i)).not.toBeInTheDocument()
    })

    expect(screen.queryByText('Exit policy')).not.toBeInTheDocument()
    expect(screen.queryByText('Exit distribution')).not.toBeInTheDocument()
  })

  it('formats null path-quality values without NaN', async () => {
    const sparseCandidate: CandidateResult = {
      ...baselineCandidate,
      exit_preset_label: 'Fixed % bracket',
      exit_quality: {
        total_closed_trades: 2,
        by_reason: { signal: { trades: 2, total_pnl: 100, win_rate: 0.5 } },
        path_quality: {
          avg_mfe_capture_ratio: null,
          avg_profit_giveback: null,
          avg_mae: null,
        },
      },
    }

    renderWithQueryClient(
      <CandidateDetailPanel
        runId="ss-run-petr4"
        candidate={sparseCandidate}
        backtest={backtest}
        objectiveMode={results.objective_mode}
        searchConfig={results.search_config}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Fixed % bracket')).toBeInTheDocument()
    })

    expect(screen.queryByText('Path quality')).not.toBeInTheDocument()
    expect(screen.queryByText('NaN')).not.toBeInTheDocument()
  })
})
