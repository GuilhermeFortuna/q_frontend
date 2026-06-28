import { setupServer } from 'msw/node'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { EncoderAblationPanel } from '../EncoderAblationPanel'
import { handlers, resetMockFeatureDeletes } from '@/mocks/handlers'
import { resetMockExperimentsState } from '@/mocks/experiments'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureDeletes()
  resetMockExperimentsState()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  server.resetHandlers()
})
afterAll(() => server.close())

describe('EncoderAblationPanel', () => {
  it('renders the initial empty-state CTA', () => {
    renderWithQueryClient(<EncoderAblationPanel />)

    expect(screen.getByTestId('ablation-empty-state')).toBeInTheDocument()
    expect(screen.getByText('No active ablation study')).toBeInTheDocument()
    expect(screen.getByTestId('ablation-submit-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('ablation-running-state')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ablation-results')).not.toBeInTheDocument()
  })

  it('submits the config list, polls, and renders the comparison table', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    renderWithQueryClient(<EncoderAblationPanel />)

    expect(screen.getByLabelText(/Symbol/i)).toHaveValue('CCM$')
    await user.click(screen.getByTestId('ablation-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('ablation-running-state')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('ablation-empty-state')).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(2_500)

    await waitFor(() => {
      expect(screen.getByTestId('ablation-results')).toBeInTheDocument()
    })

    const table = screen.getByTestId('ablation-results-table')
    expect(within(table).getByText('PCA Linear Baseline')).toBeInTheDocument()
    expect(within(table).getByText('AE Default Nonlinear')).toBeInTheDocument()
    expect(screen.getByText('Best performer:')).toHaveTextContent('PCA Linear Baseline')
    expect(within(table).getByText('0.8540')).toBeInTheDocument()
    expect(within(table).getByText('0.1695')).toBeInTheDocument()
    expect(screen.getByTestId('ablation-gate-passed-0')).toBeInTheDocument()
    expect(screen.getByTestId('ablation-gate-skipped-1')).toBeInTheDocument()
  })

  it('renders gate skipped for a failed row while other rows stay normal', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    renderWithQueryClient(<EncoderAblationPanel />)

    await user.click(screen.getByTestId('ablation-submit-btn'))
    await vi.advanceTimersByTimeAsync(2_500)

    await waitFor(() => {
      expect(screen.getByTestId('ablation-results')).toBeInTheDocument()
    })

    expect(screen.getByTestId('ablation-gate-passed-0')).toHaveTextContent('Passed')
    expect(screen.getByTestId('ablation-gate-skipped-1')).toHaveTextContent('Gate Skipped')
    expect(screen.queryByTestId('ablation-error-state')).not.toBeInTheDocument()
  })

  it('renders the panel error state for a failed job', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    renderWithQueryClient(<EncoderAblationPanel />)

    fireEvent.change(screen.getByLabelText(/Symbol/i), { target: { value: 'FAIL' } })
    await user.click(screen.getByTestId('ablation-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('ablation-error-state')).toBeInTheDocument()
    })

    expect(screen.getByTestId('ablation-error-state')).toHaveTextContent(/Mock Ablation failure/i)
    expect(screen.queryByTestId('ablation-running-state')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ablation-results')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ablation-empty-state')).not.toBeInTheDocument()
  })
})
