import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { neuralKeys } from '@/api/queries/neural'
import { NeuralFeaturesTab } from '@/components/research/neural/NeuralFeaturesTab'
import { handlers, resetMockFeatureDeletes } from '@/mocks/handlers'
import { resetMockNeuralState } from '@/mocks/neural'
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

describe('NeuralFeaturesTab training completion', () => {
  it('invalidates the models list and opens detail for the new hash', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    let activeJobId: string | null = null

    const { queryClient, rerender } = renderWithQueryClient(
      <NeuralFeaturesTab
        activeTrainingJobId={activeJobId}
        onTrainingStarted={(jobId) => {
          activeJobId = jobId
        }}
        onClearTrainingJob={vi.fn()}
      />,
    )

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await user.type(screen.getByLabelText('Symbol'), 'EURUSD')
    await user.click(screen.getByTestId('neural-train-submit'))

    await waitFor(() => {
      expect(activeJobId).toMatch(/^train_/)
    })

    rerender(
      <NeuralFeaturesTab
        activeTrainingJobId={activeJobId}
        onTrainingStarted={(jobId) => {
          activeJobId = jobId
        }}
        onClearTrainingJob={vi.fn()}
      />,
    )

    await vi.advanceTimersByTimeAsync(3_500)

    await waitFor(() => {
      expect(screen.getByTestId('neural-training-completed')).toBeInTheDocument()
      expect(screen.getByTestId('neural-model-detail')).toBeInTheDocument()
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...neuralKeys.all, 'list'] })
  })
})
