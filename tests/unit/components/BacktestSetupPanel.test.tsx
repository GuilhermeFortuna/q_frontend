import { format } from 'date-fns'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { fetchOhlcvAvailableRange } from '@/api/queries/market-data'
import { BacktestSetupPanel } from '@/components/backtests/setup/BacktestSetupPanel'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { handlers } from '@/mocks/handlers'
import { mockStrategies } from '@/mocks/data'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return {
    ...actual,
    fetchOhlcvAvailableRange: vi.fn(),
  }
})

function SetupPanelHarness({ onSubmit = vi.fn() }: { onSubmit?: ReturnType<typeof vi.fn> }) {
  const config = useBacktestConfig()
  return <BacktestSetupPanel config={config} loading={false} error={null} onSubmit={onSubmit} />
}

function renderSetup(onSubmit = vi.fn()) {
  return {
    onSubmit,
    ...renderWithQueryClient(<SetupPanelHarness onSubmit={onSubmit} />),
  }
}

async function waitForMaCrossoverSelected() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /MA Crossover/i, pressed: true })).toBeInTheDocument()
  })
}

describe('BacktestSetupPanel', () => {
  it('defaults to Fixed Quantity with quantity field visible', async () => {
    renderSetup()
    await waitForMaCrossoverSelected()

    expect(screen.getByLabelText('Sizing Mode')).toHaveValue('fixed_quantity')
    expect(screen.getByText('Quantity')).toBeInTheDocument()
    expect(screen.queryByText('Safety Margin per Contract')).not.toBeInTheDocument()
  })

  it('submits fixed_quantity payload with schema defaults', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSetup(onSubmit)
    await waitForMaCrossoverSelected()

    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.position_sizing).toEqual({
      type: 'fixed_quantity',
      quantity: 1,
    })
    expect(payload.strategy).toBe('MACrossover')
    expect(payload.strategy_params).toEqual({
      short_period: 50,
      long_period: 200,
      short_ma_type: 'sma',
      long_ma_type: 'sma',
      threshold: 0,
    })
    expect(payload.engine).toBeUndefined()
    expect(payload.costs).toBeUndefined()
  })

  it('selects a different strategy from the library and submits its defaults', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSetup(onSubmit)
    await waitForMaCrossoverSelected()

    await user.click(screen.getByRole('button', { name: /MACD Crossover/i }))
    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    const macd = mockStrategies.strategies.find((s) => s.name === 'MACD')!
    expect(onSubmit.mock.calls[0][0].strategy).toBe('MACD')
    expect(onSubmit.mock.calls[0][0].strategy_params).toEqual({
      fast_period: macd.params.find((p) => p.name === 'fast_period')!.default,
      slow_period: macd.params.find((p) => p.name === 'slow_period')!.default,
      signal_period: macd.params.find((p) => p.name === 'signal_period')!.default,
    })
  })

  it('filters strategies by engine and swaps selection when switching to tick', async () => {
    const user = userEvent.setup()
    renderSetup()
    await waitForMaCrossoverSelected()

    expect(screen.queryByRole('button', { name: /Tick MA Breakout/i })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Engine'), 'tick')

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Tick MA Breakout/i, pressed: true }),
      ).toBeInTheDocument()
    })

    expect(
      screen.queryByRole('button', { name: /MA Crossover/i, pressed: true }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Display TF')).toHaveValue('M1')
    expect(screen.getByLabelText('Tick Source')).toHaveValue('all')
    expect(screen.queryByText('Timeframe')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Engine'), 'candle')

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Bollinger Band Reversion/i, pressed: true }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Timeframe')).toBeInTheDocument()
  })

  it('shows category filter chips only for non-empty categories', async () => {
    renderSetup()
    await waitForMaCrossoverSelected()

    expect(screen.getByRole('button', { name: 'Trend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mean reversion' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Breakout' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Momentum' })).not.toBeInTheDocument()
  })

  it('loads all available data range when All is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchOhlcvAvailableRange).mockResolvedValue({
      symbol: 'PETR4',
      timeframe: 'D1',
      start: '2020-01-01T12:00:00',
      end: '2026-06-07T12:00:00',
      bar_count: 1500,
    })

    renderSetup()
    await waitForMaCrossoverSelected()

    await user.click(screen.getByTitle('Use all OHLCV data available in MetaTrader 5'))

    await waitFor(() => {
      expect(fetchOhlcvAvailableRange).toHaveBeenCalledWith('PETR4', 'D1')
    })

    const startInput = screen.getByLabelText('Start', { selector: 'input' }) as HTMLInputElement
    const endInput = screen.getByLabelText('End', { selector: 'input' }) as HTMLInputElement
    expect(startInput.value).toBe('2020-01-01')
    expect(endInput.value).toBe(format(new Date(), 'yyyy-MM-dd'))
  })
})
