import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { FeaturePassport } from '@/components/research/FeaturePassport'
import { handlers } from '@/mocks/handlers'
import { resetMockFeatureState } from '@/mocks/features'
import { renderWithQueryClient } from '../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureState()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('FeaturePassport', () => {
  it('renders definition, versions, and provenance for a fixture feature', async () => {
    renderWithQueryClient(<FeaturePassport name="rsi" />)

    await waitFor(() => {
      expect(screen.getByText('Relative Strength Index on a price source.')).toBeInTheDocument()
    })

    expect(screen.getByText('ind.rsi')).toBeInTheDocument()
    expect(screen.getByText('period')).toBeInTheDocument()
    expect(screen.getByTestId('feature-passport-forward-window')).toHaveTextContent('0')
    expect(screen.getByText('registry')).toBeInTheDocument()
    expect(screen.getByText('WO127')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('production')).toBeInTheDocument()
    expect(screen.getByText('eval_mock_rsi_1')).toBeInTheDocument()
    expect(screen.getByText('EURUSD')).toBeInTheDocument()
    expect(screen.getByText('H1')).toBeInTheDocument()
  })

  it('shows the leakage badge for a suspect fixture feature', async () => {
    renderWithQueryClient(<FeaturePassport name="leaky_signal" />)

    await waitFor(() => {
      expect(screen.getByTestId('feature-passport-leakage-badge')).toHaveTextContent(
        'Leakage: suspect',
      )
    })
  })

  it('shows the no evaluations yet state when history is empty', async () => {
    renderWithQueryClient(<FeaturePassport name="macd" />)

    await waitFor(() => {
      expect(screen.getByTestId('feature-passport-no-evaluations')).toHaveTextContent(
        'No evaluations yet.',
      )
    })
  })

  it('optimistically updates status and confirms on success', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<FeaturePassport name="macd" />)

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Candidate' })).toHaveClass('accent-state')
    })

    await user.click(screen.getByRole('radio', { name: 'Production' }))

    expect(screen.getByRole('radio', { name: 'Production' })).toHaveClass('accent-state')

    await waitFor(() => {
      expect(screen.getByTestId('feature-passport-status-message')).toHaveTextContent(
        'Status updated to production.',
      )
    })
  })

  it('reverts the status toggle when the mutation fails', async () => {
    const user = userEvent.setup()

    server.use(
      http.post('*/api/v1/features/atr/1/status', () =>
        HttpResponse.json({ detail: 'Status update failed.' }, { status: 500 }),
      ),
    )

    renderWithQueryClient(<FeaturePassport name="atr" />)

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Experimental' })).toHaveClass('accent-state')
    })

    await user.click(screen.getByRole('radio', { name: 'Candidate' }))

    await waitFor(() => {
      expect(screen.getByTestId('feature-passport-status-error')).toHaveTextContent(
        'Failed to update feature status.',
      )
      expect(screen.getByRole('radio', { name: 'Experimental' })).toHaveClass('accent-state')
    })

    expect(screen.getByRole('radio', { name: 'Candidate' })).not.toHaveClass('accent-state')
  })
})
