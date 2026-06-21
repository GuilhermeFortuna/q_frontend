import { timeframeToMs } from '@/lib/market/timeframes'
import type {
  Instrument,
  InstrumentInfo,
  MarketSnapshot,
  OhlcvBar,
  SystemHealth,
  Tick,
  TicksResponse,
} from '@/types/api'
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
import type {
  CustomStrategy,
  ExitRuleCatalogResponse,
  StrategiesResponse,
} from '@/types/strategies'

export const mockSystemHealth: SystemHealth = {
  status: 'degraded',
  backendVersion: '0.1.0-mock',
  dataLakeStatus: 'offline',
  lastSyncAt: new Date().toISOString(),
  mt5_available: false,
  active_provider: 'local',
  market_data_root: '/mock/data/market',
  market_data_inventory_count: 2,
}

export const mockInstruments: Instrument[] = [
  { symbol: 'PETR4', name: 'PETROBRAS PN N2', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'VALE3', name: 'VALE ON NM', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'ITUB4', name: 'ITAU UNIBANCO PN N1', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'WIN$', name: 'IBOVESPA MINI', exchange: 'BMF', assetClass: 'future' },
  { symbol: 'WDO$', name: 'DOLAR MINI', exchange: 'BMF', assetClass: 'future' },
]

function enrichSnapshot(
  snapshot: Pick<MarketSnapshot, 'symbol' | 'last' | 'changePct' | 'volume'> & {
    digits?: number
    bidOffset?: number
    askOffset?: number
  },
): MarketSnapshot {
  const digits = snapshot.digits ?? 2
  const spread = snapshot.askOffset ?? snapshot.bidOffset ?? 0.02
  const bid = Number((snapshot.last - spread / 2).toFixed(digits))
  const ask = Number((snapshot.last + spread / 2).toFixed(digits))
  const prevClose = Number(
    (snapshot.last - snapshot.changePct * snapshot.last * 0.01).toFixed(digits),
  )

  return {
    symbol: snapshot.symbol,
    last: snapshot.last,
    changePct: snapshot.changePct,
    volume: snapshot.volume,
    bid,
    ask,
    spread,
    changeAbs: Number((snapshot.last - prevClose).toFixed(digits)),
    dayOpen: Number((prevClose + spread).toFixed(digits)),
    dayHigh: Number((snapshot.last + spread * 2).toFixed(digits)),
    dayLow: Number((snapshot.last - spread * 3).toFixed(digits)),
    prevClose,
    digits,
    tickTime: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }
}

export const mockSnapshots: Record<string, MarketSnapshot> = {
  PETR4: enrichSnapshot({ symbol: 'PETR4', last: 42.0, changePct: -1.2, volume: 48_200_000 }),
  VALE3: enrichSnapshot({ symbol: 'VALE3', last: 64.5, changePct: 0.35, volume: 52_100_000 }),
  ITUB4: enrichSnapshot({ symbol: 'ITUB4', last: 32.1, changePct: -0.8, volume: 35_000_000 }),
  WIN$: enrichSnapshot({
    symbol: 'WIN$',
    last: 128_400.0,
    changePct: 1.05,
    volume: 120_000,
    digits: 0,
    bidOffset: 5,
    askOffset: 5,
  }),
  WDO$: enrichSnapshot({
    symbol: 'WDO$',
    last: 5120.5,
    changePct: -0.45,
    volume: 95_000,
    digits: 1,
    bidOffset: 0.5,
    askOffset: 0.5,
  }),
  SPY: enrichSnapshot({ symbol: 'SPY', last: 512.34, changePct: 0.42, volume: 48_200_000 }),
  AAPL: enrichSnapshot({ symbol: 'AAPL', last: 198.12, changePct: -0.18, volume: 52_100_000 }),
  EURUSD: enrichSnapshot({
    symbol: 'EURUSD',
    last: 1.0842,
    changePct: 0.05,
    volume: 0,
    digits: 4,
    bidOffset: 0.0002,
    askOffset: 0.0002,
  }),
  BTCUSD: enrichSnapshot({
    symbol: 'BTCUSD',
    last: 67_420.5,
    changePct: 1.24,
    volume: 0,
    digits: 1,
    bidOffset: 1,
    askOffset: 1,
  }),
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

export function getMockTicks(symbol: string, limit = 200): TicksResponse {
  const snapshot = mockSnapshots[symbol]
  const base = snapshot?.last ?? 100
  const digits = snapshot?.digits ?? 2
  const spread = snapshot?.spread ?? 0.02
  const now = Date.now()
  const ticks: Tick[] = []

  for (let index = limit - 1; index >= 0; index -= 1) {
    const side: Tick['side'] = index % 3 === 0 ? 'buy' : index % 3 === 1 ? 'sell' : null
    const priceDelta = (seededRandom(index + symbol.length * 7) - 0.5) * (base * 0.001)
    const last = Number((base + priceDelta).toFixed(digits))
    const bid = Number((last - spread / 2).toFixed(digits))
    const ask = Number((last + spread / 2).toFixed(digits))

    ticks.push({
      timestamp: new Date(now - index * 1000).toISOString(),
      bid,
      ask,
      last,
      volume: Math.floor(100 + seededRandom(index * 11) * 900),
      side,
    })
  }

  return { ticks }
}

export const mockInstrumentInfo: Record<string, InstrumentInfo> = {
  PETR4: {
    symbol: 'PETR4',
    description: 'PETROBRAS PN N2',
    exchange: 'BOVESPA',
    currencyBase: 'BRL',
    currencyProfit: 'BRL',
    digits: 2,
    point: 0.01,
    tickSize: 0.01,
    tickValue: 0.01,
    contractSize: 1,
    volumeMin: 100,
    volumeMax: 1_000_000,
    volumeStep: 100,
    spreadFloating: true,
  },
  VALE3: {
    symbol: 'VALE3',
    description: 'VALE ON NM',
    exchange: 'BOVESPA',
    currencyBase: 'BRL',
    currencyProfit: 'BRL',
    digits: 2,
    point: 0.01,
    tickSize: 0.01,
    tickValue: 0.01,
    contractSize: 1,
    volumeMin: 100,
    volumeMax: 1_000_000,
    volumeStep: 100,
    spreadFloating: true,
  },
  WIN$: {
    symbol: 'WIN$',
    description: 'Mini Indice Bovespa',
    exchange: 'BMF',
    currencyBase: 'BRL',
    currencyProfit: 'BRL',
    digits: 0,
    point: 1,
    tickSize: 5,
    tickValue: 1,
    contractSize: 0.2,
    volumeMin: 1,
    volumeMax: 500,
    volumeStep: 1,
    spreadFloating: true,
  },
  EURUSD: {
    symbol: 'EURUSD',
    description: 'Euro vs US Dollar',
    exchange: 'FOREX',
    currencyBase: 'EUR',
    currencyProfit: 'USD',
    digits: 4,
    point: 0.0001,
    tickSize: 0.00001,
    tickValue: 1,
    contractSize: 100000,
    volumeMin: 0.01,
    volumeMax: 500,
    volumeStep: 0.01,
    spreadFloating: true,
  },
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
  'run-tick-ma': {
    symbol: 'WIN$',
    start: '2025-03-01T00:00:00.000Z',
    end: '2025-04-01T00:00:00.000Z',
    initial_capital: 100000,
    point_value: 0.2,
    engine: 'tick',
    display_timeframe: 'M1',
    tick_flags: 'all',
    strategy: 'TickMaBreakout',
    strategy_params: {
      short_period: 50,
      long_period: 200,
      threshold: 0,
      sl_points: 100,
      tp_points: 200,
    },
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
    is_saved: true,
    summary: mockBacktestMetrics,
  },
  {
    run_id: 'run-vale-ma',
    symbol: 'VALE3',
    strategy: 'MACrossover',
    timeframe: 'H1',
    status: 'completed',
    created_at: hoursAgo(26),
    is_saved: false,
    summary: mockBacktestMetricsAlt,
  },
  {
    run_id: 'run-petr-failed',
    symbol: 'PETR4',
    strategy: 'MACrossover',
    timeframe: 'D1',
    status: 'failed',
    created_at: hoursAgo(72),
    is_saved: false,
    summary: null,
  },
  {
    run_id: 'run-tick-ma',
    symbol: 'WIN$',
    strategy: 'TickMaBreakout',
    timeframe: 'TICK',
    status: 'completed',
    created_at: hoursAgo(5),
    is_saved: false,
    summary: mockBacktestMetricsAlt,
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
    is_saved: summary.is_saved,
  }
}

const MA_TYPE_CHOICES = ['ema', 'hma', 'sma', 'smma', 'wma']

export const mockStrategies: StrategiesResponse = {
  strategies: [
    {
      name: 'BollingerReversion',
      label: 'Bollinger Band Reversion',
      description: 'Enter on band touch; exit on mean reversion to the middle band.',
      category: 'mean_reversion',
      thesis:
        'Prices tend to revert toward their recent mean after stretching to statistical extremes. This strategy buys band touches and exits when price returns toward the middle band.',
      strong_in: 'Range-bound markets with clear mean-reverting swings.',
      weak_in: 'Strong trends that ride along the upper or lower band.',
      params: [
        {
          name: 'period',
          label: 'Period',
          type: 'int',
          default: 20,
          min: 2,
          max: 400,
          step: 1,
          hint: 'Shorter = tighter bands, more signals.',
        },
        {
          name: 'num_std',
          label: 'Std Dev Multiplier',
          type: 'float',
          default: 2.0,
          min: 0.5,
          max: 5.0,
          step: 0.1,
          hint: 'Wider = fewer, more extreme entries.',
        },
      ],
    },
    {
      name: 'CompositeStrategy',
      label: 'Evolved composite',
      description: 'Interpreted genome DSL (genetic search only).',
      category: 'other',
      thesis: 'Interpreted genome DSL (genetic search only).',
      strong_in: '',
      weak_in: '',
      params: [],
    },
    {
      name: 'DonchianBreakout',
      label: 'Donchian Breakout',
      description: 'Enter on upper/lower channel breakouts.',
      category: 'breakout',
      thesis:
        'New highs and lows signal expanding range and potential trend continuation. Enters on channel breakouts in the direction of the break.',
      strong_in: 'Markets breaking into sustained directional moves.',
      weak_in: 'False breakouts in choppy, overlapping ranges.',
      params: [
        {
          name: 'period',
          label: 'Period',
          type: 'int',
          default: 20,
          min: 2,
          max: 400,
          step: 1,
          hint: 'Shorter = more breakouts, more whipsaws.',
        },
      ],
    },
    {
      name: 'MACD',
      label: 'MACD Crossover',
      description: 'Signal-line crossovers on MACD.',
      category: 'trend',
      thesis:
        'Trend persistence shows up as momentum building before price fully turns. MACD crossovers capture shifts in that momentum — long when the MACD line crosses above signal, flat/short on the reverse.',
      strong_in: 'Sustained directional trends with clear momentum swings.',
      weak_in: 'Sideways markets — repeated crossover whipsaws.',
      params: [
        {
          name: 'fast_period',
          label: 'Fast Period',
          type: 'int',
          default: 12,
          min: 2,
          max: 100,
          step: 1,
          hint: 'Shorter = faster momentum response, more noise.',
        },
        {
          name: 'slow_period',
          label: 'Slow Period',
          type: 'int',
          default: 26,
          min: 2,
          max: 400,
          step: 1,
          hint: 'Longer = smoother trend filter, fewer signals.',
        },
        {
          name: 'signal_period',
          label: 'Signal Period',
          type: 'int',
          default: 9,
          min: 2,
          max: 100,
          step: 1,
          hint: 'Shorter = earlier crossover entries.',
        },
      ],
    },
    {
      name: 'MACrossover',
      label: 'MA Crossover',
      description: 'Short/long moving-average crossover.',
      category: 'trend',
      thesis:
        'Trends persist because information diffuses slowly — price keeps moving in one direction while slower participants catch up. This strategy stays long while the fast average is above the slow one and flips on crossovers, accepting whipsaw losses in ranges as the price of catching large trends.',
      strong_in: 'Sustained directional trends.',
      weak_in: 'Choppy ranges — repeated whipsaw entries.',
      params: [
        {
          name: 'short_period',
          label: 'Short Period',
          type: 'int',
          default: 50,
          min: 2,
          max: 400,
          step: 1,
          hint: 'Shorter = more trades, more noise.',
        },
        {
          name: 'long_period',
          label: 'Long Period',
          type: 'int',
          default: 200,
          min: 2,
          max: 400,
          step: 1,
          hint: 'Longer = smoother trend filter, fewer signals.',
        },
        {
          name: 'short_ma_type',
          label: 'Short MA Type',
          type: 'categorical',
          default: 'sma',
          choices: MA_TYPE_CHOICES,
          hint: 'EMA reacts faster; SMA is smoother.',
        },
        {
          name: 'long_ma_type',
          label: 'Long MA Type',
          type: 'categorical',
          default: 'sma',
          choices: MA_TYPE_CHOICES,
          hint: 'Match or contrast with short MA for sensitivity.',
        },
        {
          name: 'threshold',
          label: 'Threshold',
          type: 'float',
          default: 0.0,
          min: 0.0,
          max: 100.0,
          step: 0.01,
          hint: 'Higher = require wider MA separation before entry.',
        },
      ],
    },
    {
      name: 'RSIMeanReversion',
      label: 'RSI Mean Reversion',
      description: 'Buy when RSI crosses up out of oversold; exit or short on overbought.',
      category: 'mean_reversion',
      thesis:
        'Short-term oversold bounces reflect temporary liquidity pressure rather than a regime change. Buys when RSI crosses up from oversold and exits or reverses on overbought readings.',
      strong_in: 'Range-bound markets with oscillating momentum.',
      weak_in: 'Strong trends that stay overbought or oversold for extended periods.',
      params: [
        {
          name: 'period',
          label: 'Period',
          type: 'int',
          default: 14,
          min: 2,
          max: 200,
          step: 1,
          hint: 'Shorter = more reactive RSI, more signals.',
        },
        {
          name: 'oversold',
          label: 'Oversold',
          type: 'float',
          default: 30.0,
          min: 0.0,
          max: 50.0,
          step: 0.5,
          hint: 'Higher = stricter buy threshold, fewer entries.',
        },
        {
          name: 'overbought',
          label: 'Overbought',
          type: 'float',
          default: 70.0,
          min: 50.0,
          max: 100.0,
          step: 0.5,
          hint: 'Lower = earlier exits and shorts.',
        },
      ],
    },
    {
      name: 'TickMaBreakout',
      label: 'Tick MA Breakout',
      description: 'Tick-native SMA breakout with optional stop/target distances.',
      engine: 'tick',
      category: 'breakout',
      thesis:
        'Microstructure momentum at the tick level can precede short-horizon directional moves. Enters on fast/slow tick SMA crossovers with optional stop and target distances in points.',
      strong_in: 'Liquid instruments with persistent tick-level momentum.',
      weak_in: 'Illiquid or noisy tick streams with frequent false crossovers.',
      params: [
        {
          name: 'short_period',
          label: 'Short Period (ticks)',
          type: 'int',
          default: 50,
          min: 2,
          max: 2000,
          step: 1,
          hint: 'Shorter = faster response, more signals.',
        },
        {
          name: 'long_period',
          label: 'Long Period (ticks)',
          type: 'int',
          default: 200,
          min: 2,
          max: 5000,
          step: 1,
          hint: 'Longer = smoother filter, fewer entries.',
        },
        {
          name: 'threshold',
          label: 'Threshold',
          type: 'float',
          default: 0.0,
          min: 0.0,
          max: 100.0,
          step: 0.01,
          hint: 'Higher = require wider MA gap before entry.',
        },
        {
          name: 'sl_points',
          label: 'Stop Loss (points)',
          type: 'float',
          default: 0.0,
          min: 0.0,
          max: 1000.0,
          step: 0.01,
          hint: '0 disables stop; tighter = smaller losses, more exits.',
        },
        {
          name: 'tp_points',
          label: 'Take Profit (points)',
          type: 'float',
          default: 0.0,
          min: 0.0,
          max: 1000.0,
          step: 0.01,
          hint: '0 disables target; wider = fewer hits, larger wins.',
        },
      ],
    },
  ],
}

export const mockExitRuleCatalog: ExitRuleCatalogResponse = {
  exit_rules: [
    {
      id: 'fixed_sl',
      label: 'Fixed Stop Loss',
      description: 'Exit when price moves against the position by a fixed percentage from entry.',
      exit_group: 'stop_loss',
      enable_param: 'stop_loss_pct',
      enable_value: 0.02,
      param_names: ['stop_loss_pct'],
      required_param_names: [],
    },
    {
      id: 'trailing_pct',
      label: 'Trailing Stop',
      description: 'Trail the stop as price moves in your favor by a fixed percentage.',
      exit_group: 'trailing',
      enable_param: 'trailing_stop_pct',
      enable_value: 0.015,
      param_names: ['trailing_stop_pct'],
      required_param_names: [],
    },
    {
      id: 'chandelier',
      label: 'Chandelier Exit',
      description: 'Trailing stop at peak high minus an ATR multiple.',
      exit_group: 'trailing',
      enable_param: 'chandelier_atr_mult',
      enable_value: 3,
      param_names: ['chandelier_atr_mult'],
      required_param_names: ['atr_period'],
    },
  ],
  shared_exit_params: ['atr_period'],
  exit_presets: [
    {
      id: 'atr_stop_chandelier',
      label: 'ATR stop + Chandelier trail',
      description: 'Volatility stop with a trailing lock as the trend runs.',
      parameters: {
        stop_loss_atr: 2,
        atr_period: 14,
        chandelier_atr_mult: 3,
      },
    },
  ],
}

export let mockCustomStrategies: CustomStrategy[] = []

export function resetMockCustomStrategies() {
  mockCustomStrategies = []
}
