import { timeframeToMs } from '@/lib/market/timeframes'
import type { Instrument, MarketSnapshot, OhlcvBar, SystemHealth } from '@/types/api'
import type {
  BacktestMetrics,
  BacktestRequest,
  BacktestRunDetail,
  BacktestRunSummary,
} from '@/types/backtesting'
import type {
  OptimizationBacktestConfig,
  OptimizationConfig,
  OptimizationResults,
  OptimizationStatus,
  OptimizationStudySummary,
} from '@/types/optimization'
import type { StrategiesResponse } from '@/types/strategies'

export const mockSystemHealth: SystemHealth = {
  status: 'healthy',
  backendVersion: '0.1.0-mock',
  dataLakeStatus: 'online',
  lastSyncAt: new Date().toISOString(),
}

export const mockInstruments: Instrument[] = [
  { symbol: 'PETR4', name: 'PETROBRAS PN N2', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'VALE3', name: 'VALE ON NM', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'ITUB4', name: 'ITAU UNIBANCO PN N1', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'WIN$', name: 'IBOVESPA MINI', exchange: 'BMF', assetClass: 'future' },
  { symbol: 'WDO$', name: 'DOLAR MINI', exchange: 'BMF', assetClass: 'future' },
]

export const mockSnapshots: Record<string, MarketSnapshot> = {
  PETR4: { symbol: 'PETR4', last: 42.0, changePct: -1.2, volume: 48_200_000 },
  VALE3: { symbol: 'VALE3', last: 64.5, changePct: 0.35, volume: 52_100_000 },
  ITUB4: { symbol: 'ITUB4', last: 32.1, changePct: -0.8, volume: 35_000_000 },
  WIN$: { symbol: 'WIN$', last: 128400.0, changePct: 1.05, volume: 120_000 },
  WDO$: { symbol: 'WDO$', last: 5120.5, changePct: -0.45, volume: 95_000 },
  SPY: { symbol: 'SPY', last: 512.34, changePct: 0.42, volume: 48_200_000 },
  AAPL: { symbol: 'AAPL', last: 198.12, changePct: -0.18, volume: 52_100_000 },
  EURUSD: { symbol: 'EURUSD', last: 1.0842, changePct: 0.05, volume: 0 },
  BTCUSD: { symbol: 'BTCUSD', last: 67_420.5, changePct: 1.24, volume: 0 },
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateOhlcv(symbol: string, timeframe: string, points = 500): OhlcvBar[] {
  const base = mockSnapshots[symbol]?.last ?? 100
  const bars: OhlcvBar[] = []
  let price = base * 0.98
  const barMs = timeframeToMs(timeframe)
  const now = Date.now()

  for (let i = points - 1; i >= 0; i -= 1) {
    const timestamp = new Date(now - i * barMs).toISOString()
    const rand = seededRandom(i + symbol.charCodeAt(0) * 17)
    const drift = (rand - 0.48) * (base * 0.008)
    const open = price
    const close = open + drift
    const high = Math.max(open, close) + seededRandom(i * 3) * (base * 0.003)
    const low = Math.min(open, close) - seededRandom(i * 5) * (base * 0.003)
    price = close

    bars.push({
      timestamp,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: Math.floor(1_000_000 + seededRandom(i * 7) * 4_000_000),
    })
  }

  return bars
}

const mockSeriesCache = new Map<string, OhlcvBar[]>()

function getMockSeries(symbol: string, timeframe: string): OhlcvBar[] {
  const key = `${symbol}:${timeframe}`
  if (!mockSeriesCache.has(key)) {
    mockSeriesCache.set(key, generateOhlcv(symbol, timeframe, 5000))
  }
  return mockSeriesCache.get(key)!
}

export function getMockOhlcv(
  symbol: string,
  timeframe = 'D1',
  count = 500,
  range?: { start?: string; end?: string },
): OhlcvBar[] {
  const series = getMockSeries(symbol, timeframe)

  if (range?.start || range?.end) {
    const startMs = range.start ? new Date(range.start).getTime() : Number.NEGATIVE_INFINITY
    const endMs = range.end ? new Date(range.end).getTime() : Number.POSITIVE_INFINITY
    return series.filter((bar) => {
      const ts = new Date(bar.timestamp).getTime()
      return ts >= startMs && ts <= endMs
    })
  }

  const safeCount = Math.min(Math.max(count, 1), 5000)
  return series.slice(-safeCount)
}

const mockBacktestMetrics: BacktestMetrics = {
  total_trades: 42,
  total_pnl: 12_450.75,
  win_rate: 0.57,
  winning_trades: 24,
  losing_trades: 18,
  max_drawdown_value: 3200,
  max_drawdown_pct: 0.032,
  profit_factor: 1.42,
  recovery_factor: 3.89,
  expectancy: 296.45,
  avg_win: 820.5,
  avg_loss: -410.25,
  win_loss_ratio: 2.0,
  max_consecutive_wins: 5,
  max_consecutive_losses: 3,
}

const mockBacktestMetricsAlt: BacktestMetrics = {
  total_trades: 18,
  total_pnl: -2400.5,
  win_rate: 0.39,
  winning_trades: 7,
  losing_trades: 11,
  max_drawdown_value: 5100,
  max_drawdown_pct: 0.051,
  profit_factor: 0.72,
  recovery_factor: -0.47,
  expectancy: -133.36,
  avg_win: 540.0,
  avg_loss: -560.8,
  win_loss_ratio: 0.96,
  max_consecutive_wins: 2,
  max_consecutive_losses: 4,
}

const mockBacktestConfigs: Record<string, BacktestRequest> = {
  'run-win-ma': {
    symbol: 'WIN$',
    timeframe: 'M5',
    start: '2025-01-01T00:00:00.000Z',
    end: '2025-06-01T00:00:00.000Z',
    initial_capital: 100000,
    point_value: 0.2,
    strategy: 'MACrossover',
    strategy_params: { short_period: 20, long_period: 80, threshold: 0.5 },
    position_sizing: { type: 'fixed_quantity', quantity: 2 },
  },
  'run-vale-ma': {
    symbol: 'VALE3',
    timeframe: 'H1',
    start: '2024-06-01T00:00:00.000Z',
    end: '2025-01-01T00:00:00.000Z',
    initial_capital: 250000,
    point_value: 1,
    strategy: 'MACrossover',
    strategy_params: { short_period: 12, long_period: 48, threshold: 1.25 },
    position_sizing: { type: 'fixed_quantity', quantity: 100 },
  },
  'run-petr-failed': {
    symbol: 'PETR4',
    timeframe: 'D1',
    start: '2024-01-01T00:00:00.000Z',
    end: '2024-12-31T00:00:00.000Z',
    initial_capital: 100000,
    point_value: 1,
    strategy: 'MACrossover',
    strategy_params: { short_period: 50, long_period: 200, threshold: 0 },
    position_sizing: { type: 'fixed_quantity', quantity: 1 },
  },
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

export const mockBacktestRunSummaries: BacktestRunSummary[] = [
  {
    run_id: 'run-win-ma',
    symbol: 'WIN$',
    strategy: 'MACrossover',
    timeframe: 'M5',
    status: 'completed',
    created_at: hoursAgo(2),
    summary: mockBacktestMetrics,
  },
  {
    run_id: 'run-vale-ma',
    symbol: 'VALE3',
    strategy: 'MACrossover',
    timeframe: 'H1',
    status: 'completed',
    created_at: hoursAgo(26),
    summary: mockBacktestMetricsAlt,
  },
  {
    run_id: 'run-petr-failed',
    symbol: 'PETR4',
    strategy: 'MACrossover',
    timeframe: 'D1',
    status: 'failed',
    created_at: hoursAgo(72),
    summary: null,
  },
]

function buildMockOptimizationConfig(
  studyId: string,
  backtest: OptimizationBacktestConfig,
  overrides?: Partial<OptimizationConfig['study']> & {
    objective?: OptimizationConfig['objective']
  },
): OptimizationConfig {
  const studyName =
    studyId === 'study-win-ma'
      ? 'WIN$ MA sweep'
      : studyId === 'study-vale-ma'
        ? 'VALE3 Sharpe search'
        : 'PETR4 D1 optimization'

  return {
    study: {
      name: studyName,
      n_trials:
        overrides?.n_trials ??
        (studyId === 'study-petr-failed' ? 25 : studyId === 'study-vale-ma' ? 20 : 30),
      seed: 42,
      sampler: studyId === 'study-vale-ma' ? 'tpe' : 'tpe',
      pruner: 'none',
      continue_on_trial_error: false,
      ...overrides,
    },
    objective: overrides?.objective ?? {
      mode: studyId === 'study-vale-ma' ? 'maximize_sharpe' : 'maximize_return_drawdown',
    },
    backtest,
    search_space: {
      strategy_params: {
        short_period: { type: 'int', low: 5, high: 30 },
        long_period: { type: 'int', low: 31, high: 100 },
        threshold: { type: 'float', low: 0, high: 2 },
        short_ma_type: { type: 'categorical', choices: ['sma'] },
        long_ma_type: { type: 'categorical', choices: ['sma'] },
      },
      risk_params: {
        type: { type: 'categorical', choices: ['fixed_quantity'] },
        quantity: { type: 'float', low: 1, high: 3 },
      },
    },
  }
}

const mockOptimizationBacktests: Record<string, OptimizationBacktestConfig> = {
  'study-win-ma': {
    symbol: 'WIN$',
    timeframe: 'M5',
    start: '2025-01-01T00:00:00.000Z',
    end: '2025-06-01T00:00:00.000Z',
    initial_capital: 100000,
    point_value: 0.2,
    strategy: 'MACrossover',
  },
  'study-vale-ma': {
    symbol: 'VALE3',
    timeframe: 'H1',
    start: '2024-06-01T00:00:00.000Z',
    end: '2025-01-01T00:00:00.000Z',
    initial_capital: 250000,
    point_value: 1,
    strategy: 'MACrossover',
  },
  'study-petr-failed': {
    symbol: 'PETR4',
    timeframe: 'D1',
    start: '2024-01-01T00:00:00.000Z',
    end: '2024-12-31T00:00:00.000Z',
    initial_capital: 100000,
    point_value: 1,
    strategy: 'MACrossover',
  },
}

function buildMockTrials(
  studyId: string,
  count: number,
  bestNumber: number,
): OptimizationResults['trials'] {
  return Array.from({ length: count }, (_, i) => {
    const number = i + 1
    const value = 50 + number * 12 + (studyId === 'study-vale-ma' ? -number * 3 : 0)
    return {
      number,
      params: {
        strategy__short_period: 5 + number,
        strategy__long_period: 40 + number * 2,
      },
      values: [value],
      state: 'COMPLETE',
      user_attrs: {
        status: 'complete',
        metrics: {
          total_pnl: value * 100,
          sharpe_ratio: 0.5 + number * 0.05,
          max_drawdown_pct: 0.02 + number * 0.001,
          total_trades: 10 + number,
        },
        strategy_params: {
          short_period: 5 + number,
          long_period: 40 + number * 2,
          threshold: 0.5,
        },
        risk_params: { type: 'fixed_quantity', quantity: 2 },
      },
    }
  }).map((trial) =>
    trial.number === bestNumber
      ? {
          ...trial,
          values: [trial.values![0]! + 200],
          user_attrs: {
            ...trial.user_attrs,
            metrics: {
              ...trial.user_attrs.metrics!,
              total_pnl: trial.user_attrs.metrics!.total_pnl + 20_000,
            },
          },
        }
      : trial,
  )
}

const mockOptimizationResults: Record<string, OptimizationResults> = {
  'study-win-ma': {
    study_id: 'study-win-ma',
    objective_mode: 'maximize_return_drawdown',
    is_multi_objective: false,
    best_params: {
      strategy__short_period: 12,
      strategy__long_period: 64,
    },
    best_trial: null,
    trials: buildMockTrials('study-win-ma', 30, 18),
    pareto_trials: [],
    failures: [],
  },
  'study-vale-ma': {
    study_id: 'study-vale-ma',
    objective_mode: 'maximize_sharpe',
    is_multi_objective: false,
    best_params: {
      strategy__short_period: 8,
      strategy__long_period: 52,
    },
    best_trial: null,
    trials: buildMockTrials('study-vale-ma', 20, 11),
    pareto_trials: [],
    failures: [{ trial_number: 7, error: 'zero trades' }],
  },
}

mockOptimizationResults['study-win-ma'].best_trial =
  mockOptimizationResults['study-win-ma'].trials.find((t) => t.number === 18) ?? null
mockOptimizationResults['study-vale-ma'].best_trial =
  mockOptimizationResults['study-vale-ma'].trials.find((t) => t.number === 11) ?? null

const mockOptimizationConfigs: Record<string, OptimizationConfig> = {
  'study-win-ma': buildMockOptimizationConfig(
    'study-win-ma',
    mockOptimizationBacktests['study-win-ma'],
  ),
  'study-vale-ma': buildMockOptimizationConfig(
    'study-vale-ma',
    mockOptimizationBacktests['study-vale-ma'],
  ),
  'study-petr-failed': buildMockOptimizationConfig(
    'study-petr-failed',
    mockOptimizationBacktests['study-petr-failed'],
  ),
}

const mockOptimizationStatuses: Record<string, OptimizationStatus> = {
  'study-win-ma': {
    study_id: 'study-win-ma',
    status: 'done',
    completed_trials: 30,
    n_trials: 30,
    best_value: mockOptimizationResults['study-win-ma'].best_trial?.values?.[0] ?? null,
    best_params: mockOptimizationResults['study-win-ma'].best_params,
    error: null,
    backtest_config: mockOptimizationBacktests['study-win-ma'],
    optimization_config: mockOptimizationConfigs['study-win-ma'],
  },
  'study-vale-ma': {
    study_id: 'study-vale-ma',
    status: 'done',
    completed_trials: 20,
    n_trials: 20,
    best_value: mockOptimizationResults['study-vale-ma'].best_trial?.values?.[0] ?? null,
    best_params: mockOptimizationResults['study-vale-ma'].best_params,
    error: null,
    backtest_config: mockOptimizationBacktests['study-vale-ma'],
    optimization_config: mockOptimizationConfigs['study-vale-ma'],
  },
  'study-petr-failed': {
    study_id: 'study-petr-failed',
    status: 'error',
    completed_trials: 4,
    n_trials: 25,
    best_value: null,
    best_params: {},
    error: 'Insufficient data for the requested range.',
    backtest_config: mockOptimizationBacktests['study-petr-failed'],
    optimization_config: mockOptimizationConfigs['study-petr-failed'],
  },
}

export const mockOptimizationStudySummaries: OptimizationStudySummary[] = [
  {
    study_id: 'study-win-ma',
    name: 'WIN$ MA sweep',
    status: 'done',
    best_value: mockOptimizationStatuses['study-win-ma'].best_value,
    n_trials: 30,
    completed_trials: 30,
    created_at: hoursAgo(3),
  },
  {
    study_id: 'study-vale-ma',
    name: 'VALE3 Sharpe search',
    status: 'done',
    best_value: mockOptimizationStatuses['study-vale-ma'].best_value,
    n_trials: 20,
    completed_trials: 20,
    created_at: hoursAgo(30),
  },
  {
    study_id: 'study-petr-failed',
    name: 'PETR4 D1 optimization',
    status: 'error',
    best_value: null,
    n_trials: 25,
    completed_trials: 4,
    created_at: hoursAgo(96),
  },
]

export function getMockOptimizationStatus(studyId: string): OptimizationStatus | null {
  return mockOptimizationStatuses[studyId] ?? null
}

export function getMockOptimizationResults(studyId: string): OptimizationResults | null {
  return mockOptimizationResults[studyId] ?? null
}

export function getMockBacktestRunDetail(runId: string): BacktestRunDetail | null {
  const summary = mockBacktestRunSummaries.find((r) => r.run_id === runId)
  const config = mockBacktestConfigs[runId]
  if (!summary || !config) return null

  const createdAt = summary.created_at
  const startedAt = createdAt
  const finishedAt =
    summary.status === 'completed' || summary.status === 'failed'
      ? new Date(new Date(createdAt).getTime() + 3000).toISOString()
      : null

  return {
    run_id: summary.run_id,
    symbol: summary.symbol,
    strategy: summary.strategy,
    timeframe: summary.timeframe,
    status: summary.status,
    config,
    result_summary: summary.summary,
    error_message:
      summary.status === 'failed' ? 'Insufficient data for the requested range.' : null,
    started_at: startedAt,
    finished_at: finishedAt,
    created_at: createdAt,
  }
}

const MA_TYPE_CHOICES = ['ema', 'hma', 'sma', 'smma', 'wma']

export const mockStrategies: StrategiesResponse = {
  strategies: [
    {
      name: 'BollingerReversion',
      label: 'Bollinger Band Reversion',
      description: 'Enter on band touch; exit on mean reversion to the middle band.',
      params: [
        { name: 'period', label: 'Period', type: 'int', default: 20, min: 2, max: 400, step: 1 },
        {
          name: 'num_std',
          label: 'Std Dev Multiplier',
          type: 'float',
          default: 2.0,
          min: 0.5,
          max: 5.0,
          step: 0.1,
        },
      ],
    },
    {
      name: 'DonchianBreakout',
      label: 'Donchian Breakout',
      description: 'Enter on upper/lower channel breakouts.',
      params: [
        { name: 'period', label: 'Period', type: 'int', default: 20, min: 2, max: 400, step: 1 },
      ],
    },
    {
      name: 'MACD',
      label: 'MACD Crossover',
      description: 'Signal-line crossovers on MACD.',
      params: [
        {
          name: 'fast_period',
          label: 'Fast Period',
          type: 'int',
          default: 12,
          min: 2,
          max: 100,
          step: 1,
        },
        {
          name: 'slow_period',
          label: 'Slow Period',
          type: 'int',
          default: 26,
          min: 2,
          max: 400,
          step: 1,
        },
        {
          name: 'signal_period',
          label: 'Signal Period',
          type: 'int',
          default: 9,
          min: 2,
          max: 100,
          step: 1,
        },
      ],
    },
    {
      name: 'MACrossover',
      label: 'MA Crossover',
      description: 'Short/long moving-average crossover.',
      params: [
        {
          name: 'short_period',
          label: 'Short Period',
          type: 'int',
          default: 50,
          min: 2,
          max: 400,
          step: 1,
        },
        {
          name: 'long_period',
          label: 'Long Period',
          type: 'int',
          default: 200,
          min: 2,
          max: 400,
          step: 1,
        },
        {
          name: 'short_ma_type',
          label: 'Short MA Type',
          type: 'categorical',
          default: 'sma',
          choices: MA_TYPE_CHOICES,
        },
        {
          name: 'long_ma_type',
          label: 'Long MA Type',
          type: 'categorical',
          default: 'sma',
          choices: MA_TYPE_CHOICES,
        },
        {
          name: 'threshold',
          label: 'Threshold',
          type: 'float',
          default: 0.0,
          min: 0.0,
          max: 100.0,
          step: 0.01,
        },
      ],
    },
    {
      name: 'RSIMeanReversion',
      label: 'RSI Mean Reversion',
      description: 'Buy when RSI crosses up out of oversold; exit or short on overbought.',
      params: [
        { name: 'period', label: 'Period', type: 'int', default: 14, min: 2, max: 200, step: 1 },
        {
          name: 'oversold',
          label: 'Oversold',
          type: 'float',
          default: 30.0,
          min: 0.0,
          max: 50.0,
          step: 0.5,
        },
        {
          name: 'overbought',
          label: 'Overbought',
          type: 'float',
          default: 70.0,
          min: 50.0,
          max: 100.0,
          step: 0.5,
        },
      ],
    },
  ],
}
