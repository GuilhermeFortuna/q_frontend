import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OptimizeSetupPanel } from '@/components/optimize/setup/OptimizeSetupPanel'
import { useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import { handlers } from '@/mocks/handlers'
import { resetMockCustomStrategies } from '@/mocks/data'
import { renderWithQueryClient } from '../testUtils'
import {
  mockOptimizeCustomSaved,
  mockOptimizeCustomStrategy,
  strategiesWithCustomCustom,
} from '../fixtures/optimizeCustomStrategyFixtures'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockCustomStrategies()
})
afterAll(() => server.close())

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return { ...actual, fetchOhlcvAvailableRange: vi.fn() }
})

function OptimizeSetupHarness({ onSubmit = vi.fn() }: { onSubmit?: ReturnType<typeof vi.fn> }) {
  const config = useOptimizeConfig()
  return <OptimizeSetupPanel config={config} loading={false} error={null} onSubmit={onSubmit} />
}

function useCustomStrategyMocks() {
  server.use(
    http.get('*/api/v1/strategies', () => HttpResponse.json(strategiesWithCustomCustom())),
    http.get('*/api/v1/strategies/custom', () => HttpResponse.json([mockOptimizeCustomSaved])),
  )
}

describe('OptimizeSetupPanel custom strategies', () => {
  it('lists a saved custom in the strategy library with a Custom badge', async () => {
    useCustomStrategyMocks()
    renderWithQueryClient(<OptimizeSetupHarness />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /MyCustomMA/i })).toBeInTheDocument()
    })

    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0)
  })

  it('shows entry search-space fields when a custom is selected', async () => {
    useCustomStrategyMocks()
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeSetupHarness />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /MyCustomMA/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /MyCustomMA/i }))

    await waitFor(() => {
      expect(screen.getByText('Short Period')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Exit Strategies' })).toBeInTheDocument()
      expect(
        screen.getByText('Selected exits are searched (on/off + magnitude).'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Fixed Stop Loss/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Trailing Stop/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('enabling an exit card adds its search-space fields to the detail panel', async () => {
    useCustomStrategyMocks()
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeSetupHarness />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /MyCustomMA/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /MyCustomMA/i }))

    await waitFor(() => {
      expect(screen.getByText('Stop Loss %')).toBeInTheDocument()
      expect(screen.getByText('Trailing Stop %')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Fixed Stop Loss/i }))

    await waitFor(() => {
      expect(screen.queryByText('Stop Loss %')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Fixed Stop Loss/i }))

    await waitFor(() => {
      expect(screen.getByText('Stop Loss %')).toBeInTheDocument()
    })
  })

  it('submits optimization payload with only selected exit params', async () => {
    useCustomStrategyMocks()
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithQueryClient(<OptimizeSetupHarness onSubmit={onSubmit} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /MyCustomMA/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /MyCustomMA/i }))
    await user.click(screen.getByRole('button', { name: /Fixed Stop Loss/i }))
    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const config = onSubmit.mock.calls[0][0]
    expect(config.backtest.strategy).toBe(mockOptimizeCustomStrategy.name)
    expect(config.search_space.strategy_params).toMatchObject({
      short_period: expect.objectContaining({ type: 'int' }),
      trailing_stop_pct: { type: 'float', low: 0, high: 0.1, step: 0.001 },
      stop_loss_pct: { type: 'float', low: 0, high: 0, step: null },
    })
  })

  it('submits optimization with strategy set to the custom name and all default exits', async () => {
    useCustomStrategyMocks()
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithQueryClient(<OptimizeSetupHarness onSubmit={onSubmit} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /MyCustomMA/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /MyCustomMA/i }))
    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const config = onSubmit.mock.calls[0][0]
    expect(config.backtest.strategy).toBe(mockOptimizeCustomStrategy.name)
    expect(config.search_space.strategy_params).toMatchObject({
      short_period: expect.objectContaining({ type: 'int' }),
      stop_loss_pct: { type: 'float', low: 0, high: 0.1, step: 0.001 },
      trailing_stop_pct: { type: 'float', low: 0, high: 0.1, step: 0.001 },
    })
  })

  it('filters saved customs by engine in the Saved category', async () => {
    useCustomStrategyMocks()
    const user = userEvent.setup()
    renderWithQueryClient(<OptimizeSetupHarness />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Saved' }))

    const savedCard = screen.getByRole('button', { name: /MyCustomMA.*Custom/i })
    expect(within(savedCard).getByText('Custom')).toBeInTheDocument()
  })
})
