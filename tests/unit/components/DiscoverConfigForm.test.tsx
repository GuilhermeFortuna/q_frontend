import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DiscoverConfigForm } from '@/components/discover/DiscoverConfigForm'
import { handlers, resetMockStrategySearchDeletes } from '@/mocks/handlers'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockStrategySearchDeletes()
})
afterAll(() => server.close())

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return { ...actual, fetchOhlcvAvailableRange: vi.fn() }
})

describe('DiscoverConfigForm', () => {
  it('shows candidate count and window hints', async () => {
    renderWithQueryClient(<DiscoverConfigForm loading={false} error={null} onSubmit={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Will run/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/strategies ×/i)).toBeInTheDocument()
    expect(screen.getByText(/Implied windows for this range/i)).toBeInTheDocument()
  })

  it('shows min_windows warning when implied windows are too low', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<DiscoverConfigForm loading={false} error={null} onSubmit={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Will run/i)).toBeInTheDocument()
    })

    await user.clear(screen.getByLabelText(/Train days/i))
    await user.type(screen.getByLabelText(/Train days/i), '300')
    await user.clear(screen.getByLabelText(/Test days/i))
    await user.type(screen.getByLabelText(/Test days/i), '120')
    await user.clear(screen.getByLabelText(/Minimum windows/i))
    await user.type(screen.getByLabelText(/Minimum windows/i), '4')

    expect(screen.getByText(/Fewer windows than minimum/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Strategy Search' })).toBeDisabled()
  })

  it('defaults to all candle strategies selected and sends strategies null', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithQueryClient(<DiscoverConfigForm loading={false} error={null} onSubmit={onSubmit} />)

    await waitFor(() => {
      expect(screen.getByText(/Will run/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Run Strategy Search' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const body = onSubmit.mock.calls[0][0]
    expect(body.strategies).toBeNull()
    expect(body.walkforward).toEqual({
      train_days: 180,
      test_days: 30,
      mode: 'rolling',
      min_windows: 2,
    })
    expect(body.gates).toEqual({
      min_completed_windows: 2,
      min_oos_trades: 10,
      efficiency_low: 0.3,
      efficiency_high: 1.5,
    })
  })

  it('disables tick strategies with candle-only hint', async () => {
    renderWithQueryClient(<DiscoverConfigForm loading={false} error={null} onSubmit={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/candle only/i)).toBeInTheDocument()
    })
  })
})
