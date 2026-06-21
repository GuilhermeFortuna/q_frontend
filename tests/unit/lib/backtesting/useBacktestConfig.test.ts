import { endOfDay, startOfDay } from 'date-fns'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import {
  buildBacktestRequest,
  useBacktestConfig,
  type BacktestConfigFields,
} from '@/lib/backtesting/useBacktestConfig'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import {
  defaultPositionSizingFields,
  type PositionSizingMode,
} from '@/lib/backtesting/positionSizing'
import { defaultTransactionCostFields } from '@/lib/backtesting/transactionCosts'
import { useAppStore } from '@/store/useAppStore'
import { handlers } from '@/mocks/handlers'
import { mockSampleGenome } from '@/mocks/strategySearch'
import { createTestQueryClient } from '../../testUtils'

const server = setupServer(...handlers)

vi.mock('@/lib/backtesting/dateRange', () => ({
  defaultBacktestStart: new Date('2025-06-13T03:00:00.000Z'),
  defaultBacktestEnd: new Date('2026-06-14T02:59:59.999Z'),
}))

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
  useAppStore.setState({
    pendingBacktestConfig: null,
    pendingOptimizationConfig: null,
  })
})
afterAll(() => {
  server.close()
})

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient()
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

function candleFields(overrides: Partial<BacktestConfigFields> = {}): BacktestConfigFields {
  return {
    symbol: 'PETR4',
    timeframe: 'D1',
    startDate: defaultBacktestStart,
    endDate: defaultBacktestEnd,
    capital: 100000,
    pointValue: 1.0,
    sizingMode: 'fixed_quantity' as PositionSizingMode,
    positionSizingFields: defaultPositionSizingFields(),
    costFields: defaultTransactionCostFields(),
    strategy: 'MACrossover',
    strategyParams: {
      short_period: 50,
      long_period: 200,
      short_ma_type: 'sma',
      long_ma_type: 'sma',
      threshold: 0,
    },
    dayTrade: false,
    dayTradeStartTime: '09:00',
    dayTradeEndTime: '16:00',
    dayTradeCloseTime: '17:00',
    engine: 'candle',
    displayTimeframe: 'M1',
    tickFlags: 'all',
    ...overrides,
  }
}

describe('buildBacktestRequest', () => {
  it('matches candle engine snapshot with fixed_quantity sizing and no costs', () => {
    const payload = buildBacktestRequest(candleFields())
    expect(payload).toMatchSnapshot()
    expect(payload.engine).toBeUndefined()
    expect(payload.costs).toBeUndefined()
    expect(payload.timeframe).toBe('D1')
  })

  it('matches candle snapshot with safety margin sizing and costs', () => {
    const payload = buildBacktestRequest(
      candleFields({
        sizingMode: 'fixed_safety_margin',
        positionSizingFields: {
          ...defaultPositionSizingFields(),
          safetyMargin: 5000,
          minContracts: 2,
          maxContractsInput: '10',
        },
        costFields: { costPerContract: 5, costBps: 1.25 },
        strategyParams: {
          short_period: 20,
          long_period: 60,
          short_ma_type: 'ema',
          long_ma_type: 'sma',
          threshold: 0.5,
        },
      }),
    )
    expect(payload).toMatchSnapshot()
    expect(payload.position_sizing).toEqual({
      type: 'fixed_safety_margin',
      safety_margin_per_contract: 5000,
      min_contracts: 2,
      max_contracts: 10,
    })
    expect(payload.costs).toEqual({ cost_per_contract: 5, cost_bps: 1.25 })
  })

  it('matches tick engine snapshot with inverse volatility sizing', () => {
    const payload = buildBacktestRequest(
      candleFields({
        engine: 'tick',
        strategy: 'TickMaBreakout',
        strategyParams: {
          short_period: 50,
          long_period: 200,
          threshold: 0,
          sl_points: 50,
          tp_points: 100,
        },
        displayTimeframe: 'M5',
        tickFlags: 'trade',
        sizingMode: 'inverse_volatility',
        positionSizingFields: {
          ...defaultPositionSizingFields(),
          targetVolatilityPct: 8,
          inverseMinContracts: 1,
          inverseMaxContractsInput: '6',
        },
        dayTrade: true,
        dayTradeStartTime: '10:00',
        dayTradeEndTime: '15:00',
        dayTradeCloseTime: '16:30',
      }),
    )
    expect(payload).toMatchSnapshot()
    expect(payload.engine).toBe('tick')
    expect(payload.timeframe).toBeUndefined()
    expect(payload.display_timeframe).toBe('M5')
    expect(payload.tick_flags).toBe('trade')
    expect(payload.day_trade).toBe(true)
  })

  it('serializes dates as start/end of day ISO strings', () => {
    const start = new Date('2024-03-01T15:30:00')
    const end = new Date('2024-06-01T08:00:00')
    const payload = buildBacktestRequest(candleFields({ startDate: start, endDate: end }))
    expect(payload.start).toBe(startOfDay(start).toISOString())
    expect(payload.end).toBe(endOfDay(end).toISOString())
  })
})

describe('useBacktestConfig', () => {
  it('initializes MACrossover defaults after strategies load', async () => {
    const { result } = renderHook(() => useBacktestConfig(), { wrapper })

    await waitFor(
      () => {
        expect(result.current.buildRequest().strategy_params).toEqual({
          short_period: 50,
          long_period: 200,
          short_ma_type: 'sma',
          long_ma_type: 'sma',
          threshold: 0,
        })
      },
      { timeout: 5000 },
    )
  })

  it('preserves genome when hydrating CompositeStrategy from discovery promote', async () => {
    useAppStore.getState().setPendingBacktestConfig({
      symbol: 'WIN$',
      timeframe: 'M15',
      start: '2025-01-01T00:00:00.000Z',
      end: '2025-06-01T00:00:00.000Z',
      initial_capital: 5000,
      point_value: 0.25,
      strategy: 'CompositeStrategy',
      strategy_params: {
        genome: mockSampleGenome,
        sma_period: 12,
      },
      position_sizing: { type: 'fixed_quantity', quantity: 1 },
    })

    const { result } = renderHook(() => useBacktestConfig(), { wrapper })

    await waitFor(() => {
      expect(result.current.fields.strategy).toBe('CompositeStrategy')
    })

    expect(result.current.buildRequest().strategy_params).toEqual({
      genome: mockSampleGenome,
      sma_period: 12,
    })
    expect(useAppStore.getState().pendingBacktestConfig).toBeNull()
  })
})
