import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { BacktestSetupPanel } from '@/components/backtests/setup/BacktestSetupPanel'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { buildBacktestRequestFromCandidate } from '@/lib/discover/promoteCandidate'
import { handlers } from '@/mocks/handlers'
import { mockSampleGenome } from '@/mocks/strategySearch'
import { MOCK_CAPABILITIES } from '../fixtures/strategyBuilderFixtures'
import { useAppStore } from '@/store/useAppStore'
import { renderWithQueryClient } from '../testUtils'
import { http, HttpResponse } from 'msw'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  server.use(
    http.get('*/api/v1/strategy-builder/capabilities', () => HttpResponse.json(MOCK_CAPABILITIES)),
  )
})

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

  it('preserves evolved genome when promoting a genetic candidate to backtest', async () => {
    const pending = buildBacktestRequestFromCandidate(
      {
        candidate_id: 'genome-champion-001',
        strategy: 'CompositeStrategy',
        status: 'completed',
        rank: 1,
        objective_value: 1.28,
        robustness_score: 1.28,
        efficiency: 0.71,
        gate_flags: [],
        passed_gates: true,
        oos_metrics: { total_trades: 18 },
        is_metrics_summary: { mean_objective: 1.95, window_count: 3 },
        best_params: { strategy_params: { sma_period: 12 }, quantity: 1 },
        window_count: 3,
        completed_windows: 3,
        error: null,
        genome: mockSampleGenome,
        generation: 5,
        genome_node_count: 3,
      },
      {
        symbol: 'WIN$',
        timeframe: 'M15',
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-06-01T00:00:00.000Z',
        initial_capital: 5000,
        point_value: 0.25,
        strategy: 'CompositeStrategy',
      },
    )

    useAppStore.getState().setPendingBacktestConfig(pending)

    let capturedConfig: ReturnType<typeof useBacktestConfig> | null = null

    function PromoteHarness() {
      const config = useBacktestConfig()
      capturedConfig = config
      return <BacktestSetupPanel config={config} loading={false} error={null} onSubmit={vi.fn()} />
    }

    renderWithQueryClient(<PromoteHarness />)

    await waitFor(() => {
      expect(useAppStore.getState().pendingBacktestConfig).toBeNull()
    })

    if (!capturedConfig) {
      throw new Error('expected backtest config to be captured')
    }
    const config = capturedConfig as ReturnType<typeof useBacktestConfig>
    expect(config.fields.strategy).toBe('CompositeStrategy')
    expect(config.buildRequest().strategy_params).toEqual({
      genome: mockSampleGenome,
      sma_period: 12,
    })
  })
})
