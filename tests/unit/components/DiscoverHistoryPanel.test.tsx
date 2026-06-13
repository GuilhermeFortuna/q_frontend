import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DiscoverHistoryPanel } from '@/components/discover/DiscoverHistoryPanel'
import { handlers, resetMockStrategySearchDeletes } from '@/mocks/handlers'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockStrategySearchDeletes()
})
afterAll(() => server.close())

describe('DiscoverHistoryPanel', () => {
  it('loads history and fetches results when a search is selected', async () => {
    const user = userEvent.setup()
    const onSelectRun = vi.fn()

    renderWithQueryClient(<DiscoverHistoryPanel selectedRunId={null} onSelectRun={onSelectRun} />)

    await waitFor(() => {
      expect(screen.getByText('PETR4 discovery')).toBeInTheDocument()
    })

    await user.click(screen.getByText('PETR4 discovery'))
    expect(onSelectRun).toHaveBeenCalledWith('ss-run-petr4')

    renderWithQueryClient(
      <DiscoverHistoryPanel selectedRunId="ss-run-petr4" onSelectRun={onSelectRun} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Best strategy \(ranked on out-of-sample\)/i)).toBeInTheDocument()
    })
  })
})
