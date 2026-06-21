import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OptimizeConfigForm } from '@/components/optimize/OptimizeConfigForm'
import { hydrateOptimizeFormFromConfig } from '@/lib/optimize/hydrateConfigForm'
import { handlers } from '@/mocks/handlers'
import { mockStrategies } from '@/mocks/data'
import { useAppStore } from '@/store/useAppStore'
import type { OptimizationConfig } from '@/types/optimization'
import { renderWithQueryClient } from '../testUtils'
import {
  mockOptimizeCustomSaved,
  strategiesWithCustomCustom,
} from '../fixtures/optimizeCustomStrategyFixtures'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  useAppStore.getState().setPendingOptimizationConfig(null)
})
afterAll(() => server.close())

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return { ...actual, fetchOhlcvAvailableRange: vi.fn() }
})

function renderForm(onSubmit = vi.fn()) {
  return {
    onSubmit,
    ...renderWithQueryClient(
      <OptimizeConfigForm loading={false} error={null} onSubmit={onSubmit} />,
    ),
  }
}

describe('OptimizeConfigForm', () => {
  it('submits candle optimization without tick-only backtest keys', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const study = onSubmit.mock.calls[0][0].study
    expect(study).not.toHaveProperty('max_workers')
    const backtest = onSubmit.mock.calls[0][0].backtest
    expect(backtest.timeframe).toBe('D1')
    expect(backtest.engine).toBeUndefined()
    expect(backtest.display_timeframe).toBeUndefined()
    expect(backtest.tick_flags).toBeUndefined()
  })

  it('filters strategies by engine and resets selection when switching', async () => {
    const user = userEvent.setup()
    renderForm()

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    const strategySelect = screen.getByLabelText('Strategy')
    expect(
      Array.from(strategySelect.querySelectorAll('option')).map((option) => option.textContent),
    ).not.toContain('Tick MA Breakout')

    await user.selectOptions(screen.getByLabelText('Engine'), 'tick')

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('TickMaBreakout')
    })

    expect(
      Array.from(strategySelect.querySelectorAll('option')).map((option) => option.textContent),
    ).toEqual(['Tick MA Breakout'])
    expect(screen.getByLabelText('Display Timeframe')).toHaveValue('M1')
    expect(screen.getByLabelText('Tick Source')).toHaveValue('all')
    expect(screen.queryByText('Timeframe')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Engine'), 'candle')

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('BollingerReversion')
    })
    expect(screen.getByText('Timeframe')).toBeInTheDocument()
    expect(screen.queryByLabelText('Display Timeframe')).not.toBeInTheDocument()
  })

  it('submits tick optimization with display timeframe, tick flags, and SL/TP search space', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    await user.selectOptions(screen.getByLabelText('Engine'), 'tick')
    await user.selectOptions(screen.getByLabelText('Display Timeframe'), 'M5')
    await user.selectOptions(screen.getByLabelText('Tick Source'), 'trade')

    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const config = onSubmit.mock.calls[0][0] as OptimizationConfig
    expect(config.backtest.engine).toBe('tick')
    expect(config.backtest.display_timeframe).toBe('M5')
    expect(config.backtest.tick_flags).toBe('trade')
    expect(config.backtest.timeframe).toBeUndefined()
    expect(config.backtest.strategy).toBe('TickMaBreakout')
    expect(config.search_space.strategy_params).toMatchObject({
      short_period: expect.objectContaining({ type: 'int' }),
      long_period: expect.objectContaining({ type: 'int' }),
      sl_points: expect.objectContaining({ type: 'float' }),
      tp_points: expect.objectContaining({ type: 'float' }),
    })
  })

  it('hydrates tick engine fields from a pending optimization config', async () => {
    const tickConfig: OptimizationConfig = {
      study: {
        name: 'tick study',
        n_trials: 5,
        seed: 1,
      },
      objective: { mode: 'maximize_net_profit' },
      backtest: {
        symbol: 'WIN$',
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-02-01T00:00:00.000Z',
        initial_capital: 50_000,
        point_value: 0.2,
        strategy: 'TickMaBreakout',
        engine: 'tick',
        display_timeframe: 'M15',
        tick_flags: 'trade',
      },
      search_space: {
        strategy_params: {
          short_period: { type: 'int', low: 10, high: 20 },
          long_period: { type: 'int', low: 30, high: 50 },
          sl_points: { type: 'float', low: 50, high: 100 },
          tp_points: { type: 'float', low: 100, high: 200 },
        },
        risk_params: {
          type: { type: 'categorical', choices: ['fixed_quantity'] },
          quantity: { type: 'float', low: 1, high: 2 },
        },
      },
    }

    useAppStore.getState().setPendingOptimizationConfig(tickConfig)
    renderForm()

    await waitFor(() => {
      expect(screen.getByLabelText('Engine')).toHaveValue('tick')
      expect(screen.getByLabelText('Display Timeframe')).toHaveValue('M15')
      expect(screen.getByLabelText('Tick Source')).toHaveValue('trade')
      expect(screen.getByLabelText('Strategy')).toHaveValue('TickMaBreakout')
      expect(useAppStore.getState().pendingOptimizationConfig).toBeNull()
    })
  })

  it('hydrateOptimizeFormFromConfig maps tick backtest fields', () => {
    const hydrated = hydrateOptimizeFormFromConfig(
      {
        study: { name: 'tick', n_trials: 3 },
        objective: { mode: 'maximize_net_profit' },
        backtest: {
          symbol: 'WIN$',
          timeframe: 'D1',
          start: '2025-01-01T00:00:00.000Z',
          end: '2025-02-01T00:00:00.000Z',
          initial_capital: 10_000,
          point_value: 1,
          strategy: 'TickMaBreakout',
          engine: 'tick',
          display_timeframe: 'H1',
          tick_flags: 'trade',
        },
        search_space: { strategy_params: {}, risk_params: {} },
      },
      mockStrategies.strategies,
    )

    expect(hydrated.engine).toBe('tick')
    expect(hydrated.displayTimeframe).toBe('H1')
    expect(hydrated.tickFlags).toBe('trade')
  })

  it('tags saved customs in the legacy strategy select', async () => {
    server.use(
      http.get('*/api/v1/strategies', () => HttpResponse.json(strategiesWithCustomCustom())),
      http.get('*/api/v1/strategies/custom', () => HttpResponse.json([mockOptimizeCustomSaved])),
    )
    renderForm()

    await waitFor(() => {
      const options = Array.from(screen.getByLabelText('Strategy').querySelectorAll('option')).map(
        (option) => option.textContent,
      )
      expect(options).toContain('MyCustomMA — custom')
    })
  })

  it('submits max_workers when worker processes is set in advanced settings', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    await waitFor(() => {
      expect(screen.getByLabelText('Strategy')).toHaveValue('MACrossover')
    })

    await user.click(screen.getByRole('button', { name: /Advanced Settings/i }))
    await user.type(screen.getByLabelText('Worker processes'), '4')
    await user.click(screen.getByRole('button', { name: 'Run Optimization' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].study.max_workers).toBe(4)
  })
})
