import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BacktestsWorkspace } from '@/workspaces/backtests/BacktestsWorkspace'
import { handlers } from '@/mocks/handlers'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('BacktestsWorkspace — setup/results round trip', () => {
  it('returns to setup with prior values after Edit setup without clearing results', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<BacktestsWorkspace />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /MA Crossover/i, pressed: true }),
      ).toBeInTheDocument()
    })

    const symbolInput = screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement
    await user.clear(symbolInput)
    await user.type(symbolInput, 'VALE3')

    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit setup' })).toBeInTheDocument()
    })

    expect(screen.getByText(/VALE3/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit setup' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Simulation' })).toBeInTheDocument()
    })

    expect((screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement).value).toBe('VALE3')

    await user.click(screen.getByRole('button', { name: 'Results' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit setup' })).toBeInTheDocument()
    })
  })
})
