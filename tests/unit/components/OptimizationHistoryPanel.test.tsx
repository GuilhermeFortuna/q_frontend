import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { OptimizationHistoryPanel } from '@/components/optimize/OptimizationHistoryPanel'
import { handlers, resetMockOptimizationDeletes } from '@/mocks/handlers'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockOptimizationDeletes()
})
afterAll(() => server.close())

describe('OptimizationHistoryPanel', () => {
  it('supports bulk delete selection flow', async () => {
    const user = userEvent.setup()
    const onSelectStudy = vi.fn()
    const onContinueStudy = vi.fn()

    renderWithQueryClient(
      <OptimizationHistoryPanel
        selectedStudyId={null}
        onSelectStudy={onSelectStudy}
        studyBacktestConfigs={{}}
        onContinueStudy={onContinueStudy}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Past Studies/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Select' }))
    const checkboxes = await screen.findAllByRole('checkbox')
    await user.click(checkboxes[0]!)
    await user.click(screen.getByRole('button', { name: /Delete \(1\)/i }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })
  })
})
