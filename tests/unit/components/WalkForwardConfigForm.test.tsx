import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { WalkForwardConfigForm } from '@/components/walkforward/WalkForwardConfigForm'
import { handlers, resetMockWalkForwardDeletes } from '@/mocks/handlers'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockWalkForwardDeletes()
})
afterAll(() => server.close())

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return { ...actual, fetchOhlcvAvailableRange: vi.fn() }
})

describe('WalkForwardConfigForm', () => {
  it('shows min_windows warning when implied windows are too low', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<WalkForwardConfigForm loading={false} error={null} onSubmit={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    await user.clear(screen.getByLabelText(/Train days/i))
    await user.type(screen.getByLabelText(/Train days/i), '300')
    await user.clear(screen.getByLabelText(/Test days/i))
    await user.type(screen.getByLabelText(/Test days/i), '120')
    await user.clear(screen.getByLabelText(/Minimum windows/i))
    await user.type(screen.getByLabelText(/Minimum windows/i), '4')

    expect(screen.getByText(/Implied windows for this range/i)).toBeInTheDocument()
    expect(screen.getByText(/Fewer windows than minimum/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Walk-Forward' })).toBeDisabled()
  })

  it('assembles WO24 walk-forward request body on submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithQueryClient(
      <WalkForwardConfigForm loading={false} error={null} onSubmit={onSubmit} />,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    await user.click(screen.getByRole('button', { name: 'Run Walk-Forward' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const body = onSubmit.mock.calls[0][0]
    expect(body.optimization).toBeDefined()
    expect(body.optimization.backtest.engine).toBeUndefined()
    expect(body.walkforward).toEqual({
      train_days: 180,
      test_days: 30,
      mode: 'rolling',
      min_windows: 2,
    })
  })
})
