import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { NeuralTrainForm } from '@/components/research/neural/NeuralTrainForm'
import { handlers, resetMockFeatureDeletes } from '@/mocks/handlers'
import { MOCK_NEURAL_TRAINING_FAIL_SYMBOL, resetMockNeuralState } from '@/mocks/neural'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureDeletes()
  resetMockNeuralState()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  server.resetHandlers()
})
afterAll(() => server.close())

describe('NeuralTrainForm', () => {
  it('blocks submit until the form is valid', () => {
    renderWithQueryClient(
      <NeuralTrainForm
        activeJobId={null}
        onTrainingStarted={vi.fn()}
        onTrainingCompleted={vi.fn()}
        onClearJob={vi.fn()}
      />,
    )

    expect(screen.getByTestId('neural-train-submit')).toBeDisabled()
    expect(screen.getByTestId('neural-train-missing-fields')).toHaveTextContent('symbol')
  })

  it('submits the assembled training request body', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onStarted = vi.fn()

    renderWithQueryClient(
      <NeuralTrainForm
        activeJobId={null}
        onTrainingStarted={onStarted}
        onTrainingCompleted={vi.fn()}
        onClearJob={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Symbol'), 'EURUSD')
    await user.click(screen.getByTestId('neural-train-submit'))

    await waitFor(() => {
      expect(onStarted).toHaveBeenCalled()
    })

    const [jobId, label] = onStarted.mock.calls[0]!
    expect(jobId).toMatch(/^train_/)
    expect(label).toContain('EURUSD')
    expect(label).toContain('autoencoder')
  })

  it('polls to completion and reports the new model hash', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onStarted = vi.fn()
    const onCompleted = vi.fn()

    const { rerender } = renderWithQueryClient(
      <NeuralTrainForm
        activeJobId={null}
        onTrainingStarted={onStarted}
        onTrainingCompleted={onCompleted}
        onClearJob={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Symbol'), 'EURUSD')
    await user.click(screen.getByTestId('neural-train-submit'))

    await waitFor(() => {
      expect(onStarted).toHaveBeenCalled()
    })

    const jobId = onStarted.mock.calls[0]![0] as string

    rerender(
      <NeuralTrainForm
        activeJobId={jobId}
        onTrainingStarted={onStarted}
        onTrainingCompleted={onCompleted}
        onClearJob={vi.fn()}
      />,
    )

    await vi.advanceTimersByTimeAsync(3_500)

    await waitFor(() => {
      expect(screen.getByTestId('neural-training-completed')).toBeInTheDocument()
    })

    expect(onCompleted).toHaveBeenCalledWith(expect.stringMatching(/^mock_trained_/))
  })

  it('shows a failed job error with try again', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onStarted = vi.fn()
    const onClear = vi.fn()

    const { rerender } = renderWithQueryClient(
      <NeuralTrainForm
        activeJobId={null}
        onTrainingStarted={onStarted}
        onTrainingCompleted={vi.fn()}
        onClearJob={onClear}
      />,
    )

    await user.type(screen.getByLabelText('Symbol'), MOCK_NEURAL_TRAINING_FAIL_SYMBOL)
    await user.click(screen.getByTestId('neural-train-submit'))

    await waitFor(() => {
      expect(onStarted).toHaveBeenCalled()
    })

    const jobId = onStarted.mock.calls[0]![0] as string

    rerender(
      <NeuralTrainForm
        activeJobId={jobId}
        onTrainingStarted={onStarted}
        onTrainingCompleted={vi.fn()}
        onClearJob={onClear}
      />,
    )

    await vi.advanceTimersByTimeAsync(500)

    await waitFor(() => {
      expect(screen.getByTestId('neural-training-progress-failed')).toBeInTheDocument()
    })

    expect(screen.getByText(/Mock training failure/)).toBeInTheDocument()

    await user.click(screen.getByTestId('neural-training-try-again'))
    expect(onClear).toHaveBeenCalled()
  })
})
