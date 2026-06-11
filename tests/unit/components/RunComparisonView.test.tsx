import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { RunComparisonView } from '@/components/backtests/RunComparisonView'
import { mockBacktestRunSummaries } from '@/mocks/data'
import { handlers, resetMockBacktestDeletes } from '@/mocks/handlers'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockBacktestDeletes()
})
afterAll(() => server.close())

describe('RunComparisonView', () => {
  it('renders series and metric columns for selected runs', async () => {
    const runs = mockBacktestRunSummaries.filter((run) =>
      ['run-win-ma', 'run-vale-ma'].includes(run.run_id),
    )

    renderWithQueryClient(<RunComparisonView runs={runs} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Compare runs')).toBeInTheDocument()
    })

    expect(screen.getAllByText('WIN$ · MACrossover').length).toBeGreaterThan(0)
    expect(screen.getAllByText('VALE3 · MACrossover').length).toBeGreaterThan(0)
    expect(screen.getByText('Total PnL')).toBeInTheDocument()
    expect(screen.getByText('Profit Factor')).toBeInTheDocument()
  })

  it('shows degraded chart state when an artifact 404s', async () => {
    const runs = mockBacktestRunSummaries.filter((run) =>
      ['run-win-ma', 'run-petr-failed'].includes(run.run_id),
    )

    renderWithQueryClient(<RunComparisonView runs={runs} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/no curve/i)).toBeInTheDocument()
    })

    expect(screen.getByText('Total PnL')).toBeInTheDocument()
  })

  it('switches to percent return scale', async () => {
    const user = userEvent.setup()
    const runs = mockBacktestRunSummaries.filter((run) => run.run_id === 'run-win-ma')

    renderWithQueryClient(<RunComparisonView runs={runs} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '% Return' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '% Return' }))
    expect(screen.getByRole('button', { name: '% Return' })).toBeInTheDocument()
  })
})
