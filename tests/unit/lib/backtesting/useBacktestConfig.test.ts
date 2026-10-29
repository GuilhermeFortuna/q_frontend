import { endOfDay, startOfDay } from 'date-fns'
import { http, HttpResponse } from 'msw'
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
import { defaultEntryManager } from '@/lib/backtesting/entryInstances'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import {
  defaultPositionSizingFields,
  type PositionSizingMode,
} from '@/lib/backtesting/positionSizing'
import { defaultTransactionCostFields } from '@/lib/backtesting/transactionCosts'
import { useAppStore } from '@/store/useAppStore'
import { buildBacktestRequestFromTrial } from '@/lib/optimization/bridge'
import { mockStrategies } from '@/mocks/data'
import { handlers } from '@/mocks/handlers'
import { mockSampleGenome } from '@/mocks/strategySearch'
import type { OptimizationBacktestConfig, OptimizationTrial } from '@/types/optimization'
import type { StrategyParamSpec } from '@/types/strategies'
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
  const entryParams = {
    short_period: 50,
    long_period: 200,
    short_ma_type: 'sma',
    long_ma_type: 'sma',
    threshold: 0,
  }
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
    strategyParams: {},
    entries: [
      {
        slotId: 'entry-1',
        strategy: 'MACrossover',
        params: entryParams,
      },
    ],
    entryManager: defaultEntryManager(),
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
        entries: [
          {
            slotId: 'entry-1',
            strategy: 'MACrossover',
            params: {
              short_period: 20,
              long_period: 60,
              short_ma_type: 'ema',
              long_ma_type: 'sma',
              threshold: 0.5,
            },
          },
        ],
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
        entries: [
          {
            slotId: 'entry-1',
            strategy: 'TickMaBreakout',
            params: {
              short_period: 50,
              long_period: 200,
              threshold: 0,
              sl_points: 50,
              tp_points: 100,
            },
          },
        ],
        strategyParams: {},
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

  it('omits entries and entry_manager for the tick engine', () => {
    // The tick engine builds from strategy/strategy_params and has no
    // multi-entry path; sending entries alongside them is refused by the API.
    const payload = buildBacktestRequest(
      candleFields({ engine: 'tick', strategy: 'TickMaBreakout' }),
    )

    expect(payload.entries).toBeUndefined()
    expect(payload.entry_manager).toBeUndefined()
  })

  it('still sends the tick strategy the engine actually builds from', () => {
    const payload = buildBacktestRequest(
      candleFields({
        engine: 'tick',
        strategy: 'TickMaBreakout',
        entries: [{ slotId: 'entry-1', strategy: 'TickMaBreakout', params: { short_period: 50 } }],
      }),
    )

    expect(payload.strategy).toBe('TickMaBreakout')
    expect(payload.strategy_params).toMatchObject({ short_period: 50 })
  })

  it('keeps entries and entry_manager for the candle engine', () => {
    const payload = buildBacktestRequest(candleFields({ engine: 'candle' }))

    expect(payload.entries).toHaveLength(1)
    expect(payload.entry_manager).toBeDefined()
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
        expect(result.current.entries).toHaveLength(1)
        expect(result.current.entries[0].params).toEqual({
          short_period: 50,
          long_period: 200,
          short_ma_type: 'sma',
          long_ma_type: 'sma',
          threshold: 0,
        })
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

  it('addEntry twice with the same strategy keeps independent params', async () => {
    const { result } = renderHook(() => useBacktestConfig(), { wrapper })

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1)
    })

    result.current.setters.addEntry('MACrossover')

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
    })

    result.current.setters.addEntry('MACrossover')

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(3)
    })

    const third = result.current.entries[2]
    result.current.setters.handleEntryParamChange(third.slotId, 'short_period', 12)

    await waitFor(() => {
      expect(result.current.entries[0].params.short_period).toBe(50)
      expect(result.current.entries[2].params.short_period).toBe(12)
    })

    const removedSlot = result.current.entries[2].slotId
    result.current.setters.removeEntry(removedSlot)

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
      expect(result.current.entries.some((entry) => entry.slotId === removedSlot)).toBe(false)
    })
  })

  it('buildBacktestRequest emits multi-entry payload for majority manager', () => {
    const payload = buildBacktestRequest(
      candleFields({
        entries: [
          {
            slotId: 'e0',
            strategy: 'MACrossover',
            params: { short_period: 5, long_period: 20 },
          },
          {
            slotId: 'e1',
            strategy: 'RSIMeanReversion',
            params: { period: 14, oversold: 30, overbought: 70 },
          },
        ],
        entryManager: { kind: 'majority', params: { vote_threshold: 2 } },
        strategyParams: { stop_loss_pct: 0.02 },
      }),
    )

    expect(payload.entries).toEqual([
      { strategy: 'MACrossover', params: { short_period: 5, long_period: 20 } },
      {
        strategy: 'RSIMeanReversion',
        params: { period: 14, oversold: 30, overbought: 70 },
      },
    ])
    expect(payload.entry_manager).toEqual({ kind: 'majority', params: { vote_threshold: 2 } })
    expect(payload.exit_params).toEqual({ stop_loss_pct: 0.02 })
    expect(payload.strategy_params).toEqual({ stop_loss_pct: 0.02 })
  })

  it('buildBacktestRequest keeps back-compatible payload for single instance OR', () => {
    const payload = buildBacktestRequest(candleFields())
    expect(payload.entries).toHaveLength(1)
    expect(payload.entry_manager).toEqual({ kind: 'or', params: {} })
    expect(payload.strategy).toBe('MACrossover')
    expect(payload.strategy_params).toEqual({
      short_period: 50,
      long_period: 200,
      short_ma_type: 'sma',
      long_ma_type: 'sma',
      threshold: 0,
    })
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

describe('useBacktestConfig staged from an optimization trial', () => {
  const exitSpecs: StrategyParamSpec[] = [
    {
      name: 'stop_loss_pct',
      label: 'Stop loss',
      type: 'float',
      default: 0,
      exit_group: 'stop_loss',
    },
    {
      name: 'trailing_stop_pct',
      label: 'Trailing stop',
      type: 'float',
      default: 0.015,
      exit_group: 'trailing',
    },
  ]
  const studyBacktest: OptimizationBacktestConfig = {
    symbol: 'WIN$',
    timeframe: 'M15',
    start: '2025-01-01T03:00:00.000Z',
    end: '2025-06-01T03:00:00.000Z',
    initial_capital: 5000,
    point_value: 0.2,
    strategy: 'MACrossover',
  }

  function stageTrial(
    userAttrs: OptimizationTrial['user_attrs'],
    backtest: OptimizationBacktestConfig,
  ) {
    server.use(
      http.get('*/api/v1/strategies', () =>
        HttpResponse.json({
          strategies: mockStrategies.strategies.map((info) =>
            info.name === 'MACrossover' || info.name === 'RSIMeanReversion'
              ? { ...info, params: [...info.params, ...exitSpecs] }
              : info,
          ),
        }),
      ),
    )
    const trial: OptimizationTrial = {
      number: 3,
      params: {},
      values: [1.2],
      state: 'COMPLETE',
      user_attrs: userAttrs,
    }
    useAppStore.getState().setPendingBacktestConfig(buildBacktestRequestFromTrial(trial, backtest))
  }

  it('replicates a single-entry trial with entry and exit params', async () => {
    stageTrial(
      {
        strategy_params: { short_period: 7, long_period: 30, stop_loss_pct: 0.02 },
        risk_params: { type: 'fixed_quantity', quantity: 3 },
      },
      studyBacktest,
    )

    const { result } = renderHook(() => useBacktestConfig(), { wrapper })
    await waitFor(() => {
      expect(useAppStore.getState().pendingBacktestConfig).toBeNull()
    })

    const request = result.current.buildRequest()
    expect(request.entries).toEqual([
      {
        strategy: 'MACrossover',
        params: {
          short_period: 7,
          long_period: 30,
          short_ma_type: 'sma',
          long_ma_type: 'sma',
          threshold: 0,
        },
      },
    ])
    expect(request.entry_manager).toEqual({ kind: 'or', params: {} })
    expect(request.exit_params).toEqual({ stop_loss_pct: 0.02, trailing_stop_pct: 0.015 })
    expect(request.position_sizing).toEqual({ type: 'fixed_quantity', quantity: 3 })
  })

  it('replicates a multi-entry trial with entry, manager and exit params', async () => {
    stageTrial(
      {
        strategy_params: {
          e0__short_period: 7,
          e0__long_period: 30,
          e1__period: 9,
          stop_loss_pct: 0.02,
        },
        manager_params: { vote_threshold: 2 },
        risk_params: { type: 'fixed_quantity', quantity: 3 },
      },
      {
        ...studyBacktest,
        entries: [
          { strategy: 'MACrossover', params: { short_period: 50, long_period: 200 } },
          { strategy: 'RSIMeanReversion', params: { period: 14, oversold: 25 } },
        ],
        entry_manager: { kind: 'majority', params: { vote_threshold: 1 } },
        exit_params: {},
      },
    )

    const { result } = renderHook(() => useBacktestConfig(), { wrapper })
    await waitFor(() => {
      expect(useAppStore.getState().pendingBacktestConfig).toBeNull()
    })

    const request = result.current.buildRequest()
    expect(request.entries).toEqual([
      { strategy: 'MACrossover', params: { short_period: 7, long_period: 30 } },
      { strategy: 'RSIMeanReversion', params: { period: 9, oversold: 25 } },
    ])
    expect(request.entry_manager).toEqual({ kind: 'majority', params: { vote_threshold: 2 } })
    expect(request.exit_params).toEqual({ stop_loss_pct: 0.02, trailing_stop_pct: 0.015 })
    expect(request.strategy_params).toEqual(request.exit_params)
  })
})

describe('buildBacktestRequest for strategy files', () => {
  it('sends the file id and its parameters, with no registry strategy or entries', () => {
    const payload = buildBacktestRequest(
      candleFields({
        strategyFileId: 'session_breakout',
        strategyFileParams: { range_bars: 12, enter_after: '10:30', use_filter: false },
      }),
    )

    expect(payload.strategy_file).toBe('session_breakout')
    expect(payload.strategy_params).toEqual({
      range_bars: 12,
      enter_after: '10:30',
      use_filter: false,
    })
    expect(payload.timeframe).toBe('D1')
    expect(payload.strategy).toBeUndefined()
    expect(payload.entries).toBeUndefined()
    expect(payload.entry_manager).toBeUndefined()
    expect(payload.strategy_version_id).toBeUndefined()
  })

  it('never sends registry strategy parameters as exit parameters', () => {
    const payload = buildBacktestRequest(
      candleFields({
        strategyFileId: 'late_session_trend',
        strategyFileParams: { fade: false, min_trend_z: 0.25 },
        strategyParams: { fade: false, min_trend_z: 0.25 },
      }),
    )

    expect(payload.strategy_params).toEqual({ fade: false, min_trend_z: 0.25 })
    expect(payload.exit_params).toEqual({})
  })

  it('keeps the registry request shape when no strategy file is selected', () => {
    const payload = buildBacktestRequest(candleFields({ strategyFileId: null }))

    expect(payload.strategy_file).toBeUndefined()
    expect(payload.strategy).toBe('MACrossover')
  })
})
