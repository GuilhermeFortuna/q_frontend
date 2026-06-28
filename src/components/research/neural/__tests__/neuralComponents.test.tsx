import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { NeuralModelDetail } from '@/components/research/neural/NeuralModelDetail'
import { NeuralModelList } from '@/components/research/neural/NeuralModelList'
import { handlers, resetMockFeatureDeletes } from '@/mocks/handlers'
import {
  MOCK_NEURAL_ARCHIVED_HASH,
  MOCK_NEURAL_CANDIDATE_HASH,
  MOCK_NEURAL_PRODUCTION_HASH,
  MOCK_NEURAL_TRAINED_HASH,
  resetMockNeuralState,
} from '@/mocks/neural'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureDeletes()
  resetMockNeuralState()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('NeuralModelList', () => {
  it('renders rows with status badges', async () => {
    renderWithQueryClient(<NeuralModelList selectedHash={null} onSelectModel={() => undefined} />)

    await waitFor(() => {
      expect(
        screen.getByTestId(`neural-model-row-${MOCK_NEURAL_CANDIDATE_HASH}`),
      ).toBeInTheDocument()
    })

    expect(screen.getByTestId(`neural-status-${MOCK_NEURAL_CANDIDATE_HASH}`)).toHaveTextContent(
      'Candidate',
    )
    expect(screen.getByTestId(`neural-status-${MOCK_NEURAL_TRAINED_HASH}`)).toHaveTextContent(
      'Trained',
    )
  })
})

describe('NeuralModelDetail gate verdict', () => {
  it('renders a passing gate verdict', async () => {
    renderWithQueryClient(<NeuralModelDetail modelHash={MOCK_NEURAL_CANDIDATE_HASH} />)

    await waitFor(() => {
      expect(screen.getByTestId('neural-gate-verdict')).toBeInTheDocument()
    })

    expect(screen.getByTestId('neural-gate-pass-fail')).toHaveTextContent('Gate passed')
    expect(screen.getByText('Best latent IC')).toBeInTheDocument()
    expect(screen.getByText('0.112')).toBeInTheDocument()
  })

  it('renders a failing gate verdict', async () => {
    renderWithQueryClient(<NeuralModelDetail modelHash={MOCK_NEURAL_PRODUCTION_HASH} />)

    await waitFor(() => {
      expect(screen.getByTestId('neural-gate-pass-fail')).toHaveTextContent('Gate failed')
    })
  })

  it('shows not evaluated when gate result is missing', async () => {
    renderWithQueryClient(<NeuralModelDetail modelHash={MOCK_NEURAL_TRAINED_HASH} />)

    await waitFor(() => {
      expect(screen.getByTestId('neural-gate-not-evaluated')).toHaveTextContent(
        'Gate not evaluated yet.',
      )
    })
  })
})

describe('NeuralModelDetail promote control', () => {
  it('offers only legal next states for a candidate model', async () => {
    renderWithQueryClient(<NeuralModelDetail modelHash={MOCK_NEURAL_CANDIDATE_HASH} />)

    await waitFor(() => {
      expect(screen.getByTestId('neural-promote-controls')).toBeInTheDocument()
    })

    expect(screen.getByTestId('neural-promote-production')).toBeInTheDocument()
    expect(screen.getByTestId('neural-promote-archived')).toBeInTheDocument()
    expect(screen.getByTestId('neural-promote-trained')).toBeInTheDocument()
    expect(screen.queryByTestId('neural-promote-candidate')).not.toBeInTheDocument()
  })

  it('confirms before promoting to production', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderWithQueryClient(<NeuralModelDetail modelHash={MOCK_NEURAL_CANDIDATE_HASH} />)

    await waitFor(() => {
      expect(screen.getByTestId('neural-promote-production')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('neural-promote-production'))

    expect(confirmSpy).toHaveBeenCalled()
    expect(screen.queryByTestId('neural-status-message')).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('promotes to production after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithQueryClient(<NeuralModelDetail modelHash={MOCK_NEURAL_CANDIDATE_HASH} />)

    await waitFor(() => {
      expect(screen.getByTestId('neural-promote-production')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('neural-promote-production'))

    await waitFor(() => {
      expect(screen.getByTestId('neural-status-message')).toHaveTextContent('Production')
    })
  })

  it('surfaces a 409 when the backend rejects the transition', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    server.use(
      http.post('*/api/v1/neural/models/:modelHash/status', () =>
        HttpResponse.json(
          { detail: 'Illegal transition from candidate to production.' },
          { status: 409 },
        ),
      ),
    )

    renderWithQueryClient(<NeuralModelDetail modelHash={MOCK_NEURAL_CANDIDATE_HASH} />)

    await waitFor(() => {
      expect(screen.getByTestId('neural-promote-production')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('neural-promote-production'))

    await waitFor(() => {
      expect(screen.getByTestId('neural-status-error')).toHaveTextContent(
        'Illegal transition from candidate to production.',
      )
    })
  })

  it('offers no promote controls for archived models', async () => {
    renderWithQueryClient(<NeuralModelDetail modelHash={MOCK_NEURAL_ARCHIVED_HASH} />)

    await waitFor(() => {
      expect(screen.getByTestId('neural-detail-status')).toHaveTextContent('Archived')
    })

    expect(screen.queryByTestId('neural-promote-controls')).not.toBeInTheDocument()
  })
})
