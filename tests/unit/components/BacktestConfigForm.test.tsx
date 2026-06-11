import { format } from 'date-fns'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { fetchOhlcvAvailableRange } from '@/api/queries/market-data'
import { BacktestConfigForm } from '@/components/backtests/BacktestConfigForm'
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

function renderForm(onSubmit = vi.fn()) {
  return {
    onSubmit,
    ...renderWithQueryClient(
      <BacktestConfigForm loading={false} error={null} onSubmit={onSubmit} />,
    ),
  }
}

describe('BacktestConfigForm', () => {
  it('defaults to Fixed Quantity with quantity field visible', () => {
    renderForm()

    expect(screen.getByLabelText('Position Sizing')).toHaveValue('fixed_quantity')
    expect(screen.getByText('Quantity')).toBeInTheDocument()
    expect(screen.queryByText('Safety Margin per Contract')).not.toBeInTheDocument()
  })

  it('reveals safety margin fields when switching to Fixed Safety Margin', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.selectOptions(screen.getByLabelText('Position Sizing'), 'fixed_safety_margin')

    expect(screen.getByText('Safety Margin per Contract')).toBeInTheDocument()
    expect(screen.getByText('Min Contracts')).toBeInTheDocument()
    expect(screen.getByText('Max Contracts (optional)')).toBeInTheDocument()
    expect(screen.queryByText('Quantity')).not.toBeInTheDocument()
  })

  it('disables Run Simulation when quantity is invalid', async () => {
    const user = userEvent.setup()
    renderForm()

    const quantityInput = screen.getByRole('spinbutton', { name: 'Quantity' })
    await user.clear(quantityInput)
    await user.type(quantityInput, '0')

    expect(screen.getByRole('button', { name: 'Run Simulation' })).toBeDisabled()
    expect(screen.getByText('Quantity must be greater than 0')).toBeInTheDocument()
  })

  it('submits fixed_quantity payload with schema defaults', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

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
    expect(payload.display_timeframe).toBeUndefined()
    expect(payload.tick_flags).toBeUndefined()
    expect(payload.costs).toBeUndefined()
  })

  it('omits costs from payload when both values are zero', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    expect(onSubmit.mock.calls[0][0].costs).toBeUndefined()
  })

  it('includes costs in payload when cost per contract is set', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    const costInput = screen.getByLabelText('Cost per contract (per side)')
    await user.clear(costInput)
    await user.type(costInput, '5')

    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    expect(onSubmit.mock.calls[0][0].costs).toEqual({
      cost_per_contract: 5,
      cost_bps: 0,
    })
  })

  it('submits inverse_volatility position sizing payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    await user.selectOptions(screen.getByLabelText('Position Sizing'), 'inverse_volatility')
    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    expect(onSubmit.mock.calls[0][0].position_sizing).toEqual({
      type: 'inverse_volatility',
      target_volatility_pct: 10,
      min_contracts: 0,
      max_contracts: null,
    })
  })

  it('populates defaults when selecting a different strategy', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    await user.selectOptions(screen.getByLabelText('Strategy'), 'MACD')
    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    const macd = mockStrategies.strategies.find((s) => s.name === 'MACD')!
    expect(onSubmit.mock.calls[0][0].strategy).toBe('MACD')
    expect(onSubmit.mock.calls[0][0].strategy_params).toEqual({
      fast_period: macd.params.find((p) => p.name === 'fast_period')!.default,
      slow_period: macd.params.find((p) => p.name === 'slow_period')!.default,
      signal_period: macd.params.find((p) => p.name === 'signal_period')!.default,
    })
  })

  it('submits fixed_safety_margin payload with numeric values', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await user.selectOptions(screen.getByLabelText('Position Sizing'), 'fixed_safety_margin')
    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].position_sizing).toEqual({
      type: 'fixed_safety_margin',
      safety_margin_per_contract: 5000,
      min_contracts: 1,
      max_contracts: null,
    })
  })

  it('serializes empty max contracts as null in payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await user.selectOptions(screen.getByLabelText('Position Sizing'), 'fixed_safety_margin')

    const maxContractsInput = screen.getByPlaceholderText('No limit') as HTMLInputElement
    expect(maxContractsInput.value).toBe('')

    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    const positionSizing = onSubmit.mock.calls[0][0].position_sizing
    expect(positionSizing.max_contracts).toBeNull()
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

    renderForm()

    await user.click(screen.getByRole('button', { name: 'All' }))

    await waitFor(() => {
      expect(fetchOhlcvAvailableRange).toHaveBeenCalledWith('PETR4', 'D1')
    })

    const startInput = screen.getByLabelText('Start', { selector: 'input' }) as HTMLInputElement
    const endInput = screen.getByLabelText('End', { selector: 'input' }) as HTMLInputElement
    expect(startInput.value).toBe('2020-01-01')
    expect(endInput.value).toBe(format(new Date(), 'yyyy-MM-dd'))
  })

  it('filters strategies by engine and resets selection when switching', async () => {
    const user = userEvent.setup()
    renderForm()

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    const strategySelect = screen.getByLabelText('Strategy')
    const candleOptions = Array.from(strategySelect.querySelectorAll('option')).map(
      (option) => option.textContent,
    )
    expect(candleOptions).not.toContain('Tick MA Breakout')
    expect(candleOptions).toContain('MA Crossover')

    await user.selectOptions(screen.getByLabelText('Engine'), 'tick')

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('TickMaBreakout')
    })

    const tickOptions = Array.from(strategySelect.querySelectorAll('option')).map(
      (option) => option.textContent,
    )
    expect(tickOptions).toEqual(['Tick MA Breakout'])
    expect(screen.getByLabelText('Display Timeframe')).toHaveValue('M1')
    expect(screen.getByLabelText('Tick Source')).toHaveValue('all')
    expect(screen.queryByLabelText('Timeframe')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Engine'), 'candle')

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('BollingerReversion')
    })
    expect(screen.getByText('Timeframe')).toBeInTheDocument()
    expect(screen.queryByLabelText('Display Timeframe')).not.toBeInTheDocument()
  })

  it('submits tick engine payload with display timeframe, tick flags, and SL/TP params', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    await user.selectOptions(screen.getByLabelText('Engine'), 'tick')
    await user.selectOptions(screen.getByLabelText('Display Timeframe'), 'M5')
    await user.selectOptions(screen.getByLabelText('Tick Source'), 'trade')

    const slInput = screen.getByLabelText('Stop Loss (points)')
    await user.clear(slInput)
    await user.type(slInput, '50')

    await user.click(screen.getByRole('button', { name: 'Run Simulation' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.engine).toBe('tick')
    expect(payload.display_timeframe).toBe('M5')
    expect(payload.tick_flags).toBe('trade')
    expect(payload.timeframe).toBeUndefined()
    expect(payload.strategy).toBe('TickMaBreakout')
    expect(payload.strategy_params).toMatchObject({
      short_period: 50,
      long_period: 200,
      threshold: 0,
      sl_points: 50,
      tp_points: 0,
    })
  })
})
