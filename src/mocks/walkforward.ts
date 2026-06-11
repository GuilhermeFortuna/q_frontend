import type {
  WalkForwardEquityPoint,
  WalkForwardResults,
  WalkForwardRunSummary,
  WalkForwardStatus,
  WalkForwardWindowResult,
} from '@/types/walkforward'

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

const mockWindows: WalkForwardWindowResult[] = [
  {
    index: 0,
    train_start: '2023-01-01T00:00:00Z',
    train_end: '2023-06-30T00:00:00Z',
    test_start: '2023-07-01T00:00:00Z',
    test_end: '2023-07-31T00:00:00Z',
    status: 'completed',
    best_params: { short_period: 8, long_period: 21, quantity: 1.2 },
    is_metrics: {
      total_pnl: 12000,
      sharpe_ratio: 1.4,
      max_drawdown_pct: 0.08,
      return_drawdown_ratio: 1.5,
    },
    oos_metrics: {
      total_pnl: 8200,
      sharpe_ratio: 1.1,
      max_drawdown_pct: 0.09,
      return_drawdown_ratio: 0.91,
    },
  },
  {
    index: 1,
    train_start: '2023-02-01T00:00:00Z',
    train_end: '2023-07-31T00:00:00Z',
    test_start: '2023-08-01T00:00:00Z',
    test_end: '2023-08-31T00:00:00Z',
    status: 'completed',
    best_params: { short_period: 10, long_period: 24, quantity: 1.0 },
    is_metrics: {
      total_pnl: 14000,
      sharpe_ratio: 1.55,
      max_drawdown_pct: 0.07,
      return_drawdown_ratio: 2.0,
    },
    oos_metrics: {
      total_pnl: 4500,
      sharpe_ratio: 0.6,
      max_drawdown_pct: 0.12,
      return_drawdown_ratio: 0.38,
    },
  },
  {
    index: 2,
    train_start: '2023-03-01T00:00:00Z',
    train_end: '2023-08-31T00:00:00Z',
    test_start: '2023-09-01T00:00:00Z',
    test_end: '2023-09-30T00:00:00Z',
    status: 'no_result',
    best_params: {},
    is_metrics: null,
    oos_metrics: null,
  },
]

const mockEquityCurve: WalkForwardEquityPoint[] = [
  { time: '2023-07-01T00:00:00Z', equity: 100000 },
  { time: '2023-07-15T00:00:00Z', equity: 104200 },
  { time: '2023-07-31T00:00:00Z', equity: 108200 },
  { time: '2023-08-15T00:00:00Z', equity: 110100 },
  { time: '2023-08-31T00:00:00Z', equity: 112700 },
]

export const mockWalkForwardRunSummaries: WalkForwardRunSummary[] = [
  {
    run_id: 'wf-run-win-ma',
    name: 'WIN$ walk-forward MA',
    status: 'completed',
    symbol: 'WIN$',
    strategy: 'MACrossover',
    efficiency: 0.62,
    window_count: 3,
    created_at: hoursAgo(8),
  },
  {
    run_id: 'wf-run-vale',
    name: 'VALE3 anchored WF',
    status: 'failed',
    symbol: 'VALE3',
    strategy: 'MACrossover',
    efficiency: null,
    window_count: 0,
    created_at: hoursAgo(48),
  },
]

export const mockWalkForwardStatuses: Record<string, WalkForwardStatus> = {
  'wf-run-win-ma': {
    run_id: 'wf-run-win-ma',
    status: 'completed',
    current_window: 3,
    total_windows: 3,
    phase: null,
    windows_completed: 2,
    error: null,
    backtest_config: {
      symbol: 'WIN$',
      timeframe: 'D1',
      start: '2023-01-01T00:00:00Z',
      end: '2023-12-31T00:00:00Z',
      initial_capital: 100000,
      point_value: 0.2,
      strategy: 'MACrossover',
    },
    optimization_config: {
      study: { name: 'WIN$ wf', n_trials: 20, seed: 42, pruner: 'none' },
      objective: { mode: 'maximize_return_drawdown' },
      backtest: {
        symbol: 'WIN$',
        timeframe: 'D1',
        start: '2023-01-01T00:00:00Z',
        end: '2023-12-31T00:00:00Z',
        initial_capital: 100000,
        point_value: 0.2,
        strategy: 'MACrossover',
      },
      search_space: { strategy_params: {}, risk_params: {} },
    },
    walkforward_config: {
      train_days: 180,
      test_days: 30,
      mode: 'rolling',
      min_windows: 2,
    },
  },
  'wf-run-vale': {
    run_id: 'wf-run-vale',
    status: 'failed',
    current_window: 0,
    total_windows: 0,
    phase: null,
    windows_completed: 0,
    error: 'Date range yields 1 walk-forward window(s), but min_windows is 2.',
    backtest_config: {
      symbol: 'VALE3',
      timeframe: 'D1',
      start: '2024-01-01T00:00:00Z',
      end: '2024-06-01T00:00:00Z',
      initial_capital: 100000,
      point_value: 1,
      strategy: 'MACrossover',
    },
  },
}

export const mockWalkForwardResults: Record<string, WalkForwardResults> = {
  'wf-run-win-ma': {
    run_id: 'wf-run-win-ma',
    status: 'completed',
    windows: mockWindows,
    oos_metrics: {
      total_pnl: 12700,
      win_rate: 0.52,
      total_trades: 18,
      max_drawdown_pct: 0.11,
      sharpe_ratio: 0.95,
      return_drawdown_ratio: 1.15,
    },
    efficiency: 0.62,
    equity_curve: mockEquityCurve,
    optimization_config: mockWalkForwardStatuses['wf-run-win-ma'].optimization_config,
    walkforward_config: mockWalkForwardStatuses['wf-run-win-ma'].walkforward_config,
  },
}

export function getMockWalkForwardStatus(runId: string): WalkForwardStatus | null {
  return mockWalkForwardStatuses[runId] ?? null
}

export function getMockWalkForwardResults(runId: string): WalkForwardResults | null {
  return mockWalkForwardResults[runId] ?? null
}

type MockWalkForwardJob = {
  run_id: string
  status: WalkForwardStatus['status']
  total_windows: number
  start_time: number
  request_body: unknown
}

export const mockWalkForwardJobs = new Map<string, MockWalkForwardJob>()
export const deletedWalkForwardRunIds = new Set<string>()

export function resetMockWalkForwardState() {
  mockWalkForwardJobs.clear()
  deletedWalkForwardRunIds.clear()
}

export function getUpdatedWalkForwardJob(runId: string): MockWalkForwardJob | undefined {
  const job = mockWalkForwardJobs.get(runId)
  if (!job) return undefined
  if (job.status === 'cancelled' || job.status === 'completed' || job.status === 'failed') {
    return job
  }

  const elapsed = Date.now() - job.start_time
  if (elapsed < 800) {
    job.status = 'pending'
  } else if (elapsed < 6000) {
    job.status = 'running'
  } else {
    job.status = 'completed'
  }
  return job
}

export function walkForwardStatusFromJob(job: MockWalkForwardJob): WalkForwardStatus {
  const elapsed = Date.now() - job.start_time
  let current_window = 0
  let windows_completed = 0
  let phase: WalkForwardStatus['phase'] = 'optimizing'

  if (job.status === 'pending') {
    current_window = 0
    windows_completed = 0
    phase = 'optimizing'
  } else if (job.status === 'running') {
    const progress = Math.min(1, (elapsed - 800) / 5200)
    windows_completed = Math.min(job.total_windows - 1, Math.floor(progress * job.total_windows))
    current_window = windows_completed
    phase = progress > 0.5 ? 'testing' : 'optimizing'
  } else if (job.status === 'completed') {
    current_window = job.total_windows
    windows_completed = job.total_windows
    phase = null
  }

  return {
    run_id: job.run_id,
    status: job.status,
    current_window,
    total_windows: job.total_windows,
    phase,
    windows_completed,
    error: null,
    optimization_config: (
      job.request_body as { optimization?: WalkForwardResults['optimization_config'] }
    )?.optimization,
    walkforward_config: (
      job.request_body as { walkforward?: WalkForwardResults['walkforward_config'] }
    )?.walkforward,
    backtest_config: (
      job.request_body as { optimization?: { backtest?: WalkForwardStatus['backtest_config'] } }
    )?.optimization?.backtest,
  }
}

export function walkForwardResultsFromJob(job: MockWalkForwardJob): WalkForwardResults {
  const body = job.request_body as {
    optimization: NonNullable<WalkForwardResults['optimization_config']>
    walkforward: NonNullable<WalkForwardResults['walkforward_config']>
  }

  return {
    run_id: job.run_id,
    status: job.status === 'cancelled' ? 'cancelled' : 'completed',
    windows: mockWindows.slice(0, Math.max(1, job.total_windows - 1)),
    oos_metrics: mockWalkForwardResults['wf-run-win-ma'].oos_metrics,
    efficiency: 0.58,
    equity_curve: mockEquityCurve,
    optimization_config: body.optimization,
    walkforward_config: body.walkforward,
  }
}
