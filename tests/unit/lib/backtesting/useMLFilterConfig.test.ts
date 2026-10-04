import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { useStrategies } from '@/api/queries/strategies'
import { defaultEntryManager } from '@/lib/backtesting/entryInstances'
import {
  buildMlFilterBacktestConfig,
  earliestBacktestStart,
} from '@/lib/backtesting/mlFilterConfig'
import {
  buildBacktestRequest,
  useBacktestConfig,
  type BacktestConfigFields,
} from '@/lib/backtesting/useBacktestConfig'
import { defaultPositionSizingFields } from '@/lib/backtesting/positionSizing'
import { defaultTransactionCostFields } from '@/lib/backtesting/transactionCosts'
import { handlers } from '@/mocks/handlers'
import {
  MOCK_ML_INCOMPATIBLE_MODEL_ID,
  MOCK_ML_READY_MODEL_ID,
  resetMockMlFilterState,
} from '@/mocks/mlFilters'
import { initialMlFilterSession } from '@/store/slices/jobSessionsSlice'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'
import { createTestQueryClient } from '../../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetMockMlFilterState())
afterEach(() => {
  server.resetHandlers()
  useAppStore.setState({
    pendingBacktestConfig: null,
    mlFilterSession: { ...initialMlFilterSession },
  })
})
afterAll(() => server.close())

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children)
}

const MA_PARAMS = { short_period: 20, long_period: 80, threshold: 0.5 }

function mlRestoreConfig(overrides: Partial<BacktestRequest> = {}): BacktestRequest {
  return {
    symbol: 'WIN$',
    timeframe: 'M5',
    start: '2026-03-18T03:00:00.000Z',
    end: '2026-05-04T03:00:00.000Z',
    initial_capital: 100000,
    point_value: 0.2,
    strategy: 'MACrossoverMLFilter',
    strategy_params: MA_PARAMS,
    entries: [{ strategy: 'MACrossoverMLFilter', params: MA_PARAMS }],
    entry_manager: { kind: 'or', params: {} },
    position_sizing: { type: 'fixed_quantity', quantity: 2 },
    ml_filter: { model_version_id: MOCK_ML_READY_MODEL_ID, threshold: 0.6 },
    ...overrides,
  }
}

async function renderRestored(config: BacktestRequest) {
  useAppStore.setState({ pendingBacktestConfig: config })
  const hook = renderHook(() => useBacktestConfig(), { wrapper })
  await waitFor(() => expect(hook.result.current.fields.strategy).toBe(config.strategy))
  await waitFor(() => expect(useAppStore.getState().pendingBacktestConfig).toBeNull())
  return hook
}

function baseFields(overrides: Partial<BacktestConfigFields> = {}): BacktestConfigFields {
  return {
    symbol: 'WIN$',
    timeframe: 'M5',
    startDate: new Date('2026-03-18T03:00:00.000Z'),
    endDate: new Date('2026-05-04T03:00:00.000Z'),
    capital: 100000,
    pointValue: 0.2,
    sizingMode: 'fixed_quantity',
    positionSizingFields: defaultPositionSizingFields(),
    costFields: defaultTransactionCostFields(),
    strategy: 'MACrossover',
    strategyParams: {},
    entries: [{ slotId: 'entry-1', strategy: 'MACrossover', params: MA_PARAMS }],
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

describe('buildBacktestRequest with an ML filter', () => {
  it('leaves the original MACrossover request unchanged', () => {
    const plain = buildBacktestRequest(baseFields())
    const withStaleModel = buildBacktestRequest(
      baseFields({ mlFilter: { modelVersionId: MOCK_ML_READY_MODEL_ID, threshold: 0.7 } }),
    )
    expect(withStaleModel).toEqual(plain)
    expect(plain).not.toHaveProperty('ml_filter')
  })

  it('sends the exact version and threshold for the variant', () => {
    const request = buildBacktestRequest(
      baseFields({
        strategy: 'MACrossoverMLFilter',
        entries: [{ slotId: 'entry-1', strategy: 'MACrossoverMLFilter', params: MA_PARAMS }],
        mlFilter: { modelVersionId: MOCK_ML_READY_MODEL_ID, threshold: 0.65 },
      }),
    )
    expect(request.strategy).toBe('MACrossoverMLFilter')
    expect(request.ml_filter).toEqual({
      model_version_id: MOCK_ML_READY_MODEL_ID,
      threshold: 0.65,
    })
    expect(request.strategy_params).toMatchObject(MA_PARAMS)
  })
})

describe('buildMlFilterBacktestConfig', () => {
  it('inherits the baseline and starts at or after the training end', () => {
    const request = buildMlFilterBacktestConfig({
      source: {
        symbol: 'WIN$',
        timeframe: 'M5',
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-06-01T00:00:00.000Z',
        strategy: 'MACrossover',
        strategy_params: MA_PARAMS,
        position_sizing: { type: 'fixed_quantity', quantity: 2 },
      },
      trainEnd: '2026-03-18T15:00:00Z',
      modelVersionId: MOCK_ML_READY_MODEL_ID,
      now: new Date('2026-06-01T12:00:00Z'),
    })
    expect(request.strategy).toBe('MACrossoverMLFilter')
    expect(request.ml_filter).toEqual({ model_version_id: MOCK_ML_READY_MODEL_ID, threshold: 0.5 })
    expect(new Date(request.start as string).getTime()).toBeGreaterThanOrEqual(
      Date.parse('2026-03-18T15:00:00Z'),
    )
    expect(new Date(request.end as string).getTime()).toBeGreaterThan(
      new Date(request.start as string).getTime(),
    )
    expect(earliestBacktestStart('2026-03-18T03:00:00Z').toISOString()).toBe(
      '2026-03-18T03:00:00.000Z',
    )
  })
})

describe('useBacktestConfig ML filter integration', () => {
  it('restores the saved model, threshold, config and date range', async () => {
    const { result } = await renderRestored(mlRestoreConfig())
    expect(result.current.fields.mlFilter).toEqual({
      modelVersionId: MOCK_ML_READY_MODEL_ID,
      threshold: 0.6,
    })
    expect(result.current.fields.symbol).toBe('WIN$')
    expect(result.current.entries).toHaveLength(1)
    await waitFor(() => expect(result.current.mlFilter.context.status).toBe('ready'))
    await waitFor(() => expect(result.current.mlFilter.context.baseline).not.toBeNull())
    expect(result.current.validation.mlFilter.errors).toEqual({})
    expect(result.current.validation.formInvalid).toBe(false)
    expect(result.current.buildRequest().ml_filter).toEqual({
      model_version_id: MOCK_ML_READY_MODEL_ID,
      threshold: 0.6,
    })
  })

  it('blocks submission for a missing model without clearing the selection', async () => {
    const { result } = await renderRestored(
      mlRestoreConfig({ ml_filter: { model_version_id: 'mlf-gone', threshold: 0.5 } }),
    )
    await waitFor(() => expect(result.current.mlFilter.context.status).toBe('missing'))
    expect(result.current.fields.mlFilter?.modelVersionId).toBe('mlf-gone')
    expect(result.current.validation.formInvalid).toBe(true)
    expect(result.current.validation.mlFilter.errors.model).toMatch(/not found/)
  })

  it('blocks incompatible models and reports the server reasons', async () => {
    const { result } = await renderRestored(
      mlRestoreConfig({
        ml_filter: { model_version_id: MOCK_ML_INCOMPATIBLE_MODEL_ID, threshold: 0.5 },
      }),
    )
    await waitFor(() => expect(result.current.mlFilter.context.status).toBe('incompatible'))
    expect(result.current.validation.mlFilter.errors.model).toMatch(/checksum/)
    expect(result.current.validation.formInvalid).toBe(true)
    expect(result.current.fields.mlFilter?.modelVersionId).toBe(MOCK_ML_INCOMPATIBLE_MODEL_ID)
  })

  it('requires a correction when the backtest overlaps training data', async () => {
    const { result } = await renderRestored(mlRestoreConfig({ start: '2026-02-01T03:00:00.000Z' }))
    await waitFor(() => expect(result.current.validation.mlFilter.errors.dates).toBeDefined())
    expect(result.current.validation.mlFilter.errors.dates).toMatch(/overlaps/)
    expect(result.current.validation.formInvalid).toBe(true)
  })

  it('flags later edits that break the model baseline instead of swapping models', async () => {
    const { result } = await renderRestored(mlRestoreConfig())
    await waitFor(() => expect(result.current.mlFilter.context.baseline).not.toBeNull())
    const slotId = result.current.entries[0].slotId
    act(() => result.current.setters.handleEntryParamChange(slotId, 'short_period', 33))
    await waitFor(() =>
      expect(result.current.validation.mlFilter.errors.baseline).toMatch(/MA parameters/),
    )
    expect(result.current.validation.formInvalid).toBe(true)
    expect(result.current.fields.mlFilter?.modelVersionId).toBe(MOCK_ML_READY_MODEL_ID)

    act(() => result.current.setters.handleEntryParamChange(slotId, 'short_period', 20))
    await waitFor(() => expect(result.current.validation.mlFilter.errors.baseline).toBeUndefined())
  })

  it('reports restored unsupported compositions with an actionable error', async () => {
    const { result } = await renderRestored(
      mlRestoreConfig({
        entries: [
          { strategy: 'MACrossoverMLFilter', params: MA_PARAMS },
          { strategy: 'MACrossoverMLFilter', params: MA_PARAMS },
        ],
        entry_manager: { kind: 'and', params: {} },
      }),
    )
    expect(result.current.validation.mlFilter.errors.composition).toMatch(
      /exactly one candle entry/,
    )
    expect(result.current.validation.formInvalid).toBe(true)
  })

  it('selecting a version loads its baseline into the visible form', async () => {
    const { result } = renderHook(() => useBacktestConfig(), { wrapper })
    await waitFor(() => expect(result.current.strategies.length).toBeGreaterThan(0))
    act(() => result.current.setters.handleStrategyChange('MACrossoverMLFilter'))
    await waitFor(() => expect(result.current.fields.strategy).toBe('MACrossoverMLFilter'))
    expect(result.current.validation.mlFilter.errors.model).toBe('Select a saved model version.')

    await act(async () => {
      await result.current.mlFilter.selectModel(MOCK_ML_READY_MODEL_ID)
    })
    await waitFor(() => expect(result.current.fields.symbol).toBe('WIN$'))
    expect(result.current.fields.timeframe).toBe('M5')
    expect(result.current.entries[0].params).toMatchObject({ short_period: 20, long_period: 80 })
    expect(result.current.fields.mlFilter?.modelVersionId).toBe(MOCK_ML_READY_MODEL_ID)
    await waitFor(() => expect(result.current.validation.mlFilter.errors).toEqual({}))
  })

  it('keeps the selected model and reports the error when the baseline cannot be loaded', async () => {
    const { result } = renderHook(() => useBacktestConfig(), { wrapper })
    await waitFor(() => expect(result.current.strategies.length).toBeGreaterThan(0))
    act(() => result.current.setters.handleStrategyChange('MACrossoverMLFilter'))
    await act(async () => {
      await result.current.mlFilter.selectModel(MOCK_ML_INCOMPATIBLE_MODEL_ID)
    })
    expect(result.current.mlFilter.baselineError).toBeTruthy()
    expect(result.current.fields.mlFilter?.modelVersionId).toBe(MOCK_ML_INCOMPATIBLE_MODEL_ID)
  })

  it('does not offer extra entries for the variant', async () => {
    const { result } = await renderRestored(mlRestoreConfig())
    act(() => result.current.setters.addEntry('MACrossover'))
    expect(result.current.entries).toHaveLength(1)
  })
})

describe('research-only exclusion', () => {
  it('hides the variant from optimize, validate and discover but not from backtests', async () => {
    const included = renderHook(() => useStrategies(), { wrapper })
    const excluded = renderHook(() => useStrategies({ researchOnly: 'exclude' }), { wrapper })
    await waitFor(() => expect(included.result.current.data).toBeDefined())
    await waitFor(() => expect(excluded.result.current.data).toBeDefined())
    const names = (query: typeof included) =>
      query.result.current.data?.strategies.map((strategy) => strategy.name) ?? []
    expect(names(included)).toContain('MACrossoverMLFilter')
    expect(names(excluded)).not.toContain('MACrossoverMLFilter')
    expect(names(excluded)).toContain('MACrossover')
  })
})
