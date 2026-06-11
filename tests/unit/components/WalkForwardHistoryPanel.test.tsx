import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { WalkForwardHistoryPanel } from '@/components/walkforward/WalkForwardHistoryPanel'
import { handlers, resetMockWalkForwardDeletes } from '@/mocks/handlers'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockWalkForwardDeletes()
})
afterAll(() => server.close())

describe('WalkForwardHistoryPanel', () => {
  it('loads history and fetches results when a run is selected', async () => {
    const user = userEvent.setup()
    const onSelectRun = vi.fn()

    renderWithQueryClient(
      <WalkForwardHistoryPanel selectedRunId={null} onSelectRun={onSelectRun} />,
    )

    await waitFor(() => {
      expect(screen.getByText('WIN$ walk-forward MA')).toBeInTheDocument()
    })

    await user.click(screen.getByText('WIN$ walk-forward MA'))

    expect(onSelectRun).toHaveBeenCalledWith('wf-run-win-ma')

    renderWithQueryClient(
      <WalkForwardHistoryPanel selectedRunId="wf-run-win-ma" onSelectRun={onSelectRun} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Walk-forward efficiency/i)).toBeInTheDocument()
    })
  })
})
