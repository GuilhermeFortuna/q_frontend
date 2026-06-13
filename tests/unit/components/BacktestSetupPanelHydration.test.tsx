import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { BacktestSetupPanel } from '@/components/backtests/setup/BacktestSetupPanel'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { handlers } from '@/mocks/handlers'
import { useAppStore } from '@/store/useAppStore'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return { ...actual, fetchOhlcvAvailableRange: vi.fn() }
})

function SetupPanelHarness() {
  const config = useBacktestConfig()
  return <BacktestSetupPanel config={config} loading={false} error={null} onSubmit={vi.fn()} />
}

describe('BacktestSetupPanel — hydration from pending config', () => {
  it('hydrates fields from a staged config and clears it', async () => {
    useAppStore.getState().setPendingBacktestConfig({
      symbol: 'VALE3',
      timeframe: 'H1',
      start: '2024-03-01T00:00:00.000Z',
      end: '2024-06-01T00:00:00.000Z',
      initial_capital: 250000,
      point_value: 10,
      strategy: 'MACrossover',
      strategy_params: { short_period: 12, long_period: 48, threshold: 1.25 },
      position_sizing: { type: 'fixed_quantity', quantity: 4 },
    })

    renderWithQueryClient(<SetupPanelHarness />)

    const symbolInput = screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement
    expect(symbolInput.value).toBe('VALE3')
    expect(screen.getByDisplayValue('250000')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByDisplayValue('12')).toBeInTheDocument()
      expect(screen.getByDisplayValue('48')).toBeInTheDocument()
      expect(useAppStore.getState().pendingBacktestConfig).toBeNull()
    })
  })

  it('hydrates non-MA strategy params and selects strategy in library', async () => {
    useAppStore.getState().setPendingBacktestConfig({
      symbol: 'PETR4',
      timeframe: 'D1',
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-06-01T00:00:00.000Z',
      initial_capital: 100000,
      point_value: 1,
      strategy: 'RSIMeanReversion',
      strategy_params: { period: 21, oversold: 25, overbought: 75 },
      position_sizing: { type: 'fixed_quantity', quantity: 1 },
    })

    renderWithQueryClient(<SetupPanelHarness />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /RSI Mean Reversion/i, pressed: true }),
      ).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('21')).toBeInTheDocument()
    expect(screen.getByDisplayValue('25')).toBeInTheDocument()
    expect(screen.getByDisplayValue('75')).toBeInTheDocument()
  })

  it('hydrates costs and inverse-volatility position sizing', async () => {
    useAppStore.getState().setPendingBacktestConfig({
      symbol: 'WIN$',
      timeframe: 'D1',
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-06-01T00:00:00.000Z',
      initial_capital: 100000,
      point_value: 0.2,
      strategy: 'MACrossover',
      strategy_params: { short_period: 20, long_period: 60, threshold: 0 },
      position_sizing: {
        type: 'inverse_volatility',
        target_volatility_pct: 8,
        min_contracts: 1,
        max_contracts: 6,
      },
      costs: { cost_per_contract: 3, cost_bps: 1.5 },
    })

    renderWithQueryClient(<SetupPanelHarness />)

    await waitFor(() => {
      expect(screen.getByLabelText('Sizing Mode')).toHaveValue('inverse_volatility')
    })

    expect(screen.getByDisplayValue('8')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1.5')).toBeInTheDocument()
  })
})
