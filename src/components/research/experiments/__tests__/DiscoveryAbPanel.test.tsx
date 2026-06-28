import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { DiscoveryAbPanel } from '@/components/research/experiments/DiscoveryAbPanel'
import { handlers } from '@/mocks/handlers'
import { resetMockExperimentsState } from '@/mocks/experiments'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockExperimentsState()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  server.resetHandlers()
})
afterAll(() => server.close())

describe('DiscoveryAbPanel', () => {
  it('shows the empty-state CTA before any run is started', () => {
    renderWithQueryClient(<DiscoveryAbPanel />)

    expect(screen.getByTestId('ab-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('ab-submit-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('ab-running-state')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ab-results')).not.toBeInTheDocument()
  })

  it('submits the harness and transitions through running to a completed verdict', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    renderWithQueryClient(<DiscoveryAbPanel />)

    await user.clear(screen.getByLabelText('Symbol'))
    await user.type(screen.getByLabelText('Symbol'), 'EURUSD')
    await user.click(screen.getByTestId('ab-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('ab-running-state')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('ab-empty-state')).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(2_500)

    await waitFor(() => {
      expect(screen.getByTestId('ab-results')).toBeInTheDocument()
    })

    expect(screen.getByTestId('ab-verdict-badge')).toHaveTextContent('PROVEN PAYOFF (HELPS)')
    expect(screen.getByText('Control Mean')).toBeInTheDocument()
    expect(screen.getByText('Treatment Mean')).toBeInTheDocument()
    expect(screen.getByText("Cohen's d")).toBeInTheDocument()
    expect(screen.getByText('p-value')).toBeInTheDocument()
    expect(screen.getByText('Paired Delta')).toBeInTheDocument()
    expect(screen.getByText(/lockbox_objective/)).toBeInTheDocument()
  })

  it('renders the failed job error state instead of loading or empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    renderWithQueryClient(<DiscoveryAbPanel />)

    await user.clear(screen.getByLabelText('Symbol'))
    await user.type(screen.getByLabelText('Symbol'), 'FAIL')
    await user.click(screen.getByTestId('ab-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('ab-error-state')).toBeInTheDocument()
    })

    expect(screen.getByTestId('ab-error-state')).toHaveTextContent(/Mock Discovery A\/B failure/)
    expect(screen.queryByTestId('ab-running-state')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ab-results')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ab-empty-state')).not.toBeInTheDocument()
  })
})
