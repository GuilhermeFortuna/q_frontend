import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { BacktestHistoryPanel } from '@/components/backtests/BacktestHistoryPanel'
import { handlers, resetMockBacktestDeletes } from '@/mocks/handlers'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockBacktestDeletes()
})
afterAll(() => server.close())

describe('BacktestHistoryPanel', () => {
  it('shows saved tab and bulk delete flow', async () => {
    const user = userEvent.setup()
    const onSelectRun = vi.fn()
    const onReRun = vi.fn()

    renderWithQueryClient(
      <BacktestHistoryPanel selectedRunId={null} onSelectRun={onSelectRun} onReRun={onReRun} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Past Runs/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Saved' }))
    await waitFor(() => {
      expect(screen.getByText('1 saved')).toBeInTheDocument()
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
