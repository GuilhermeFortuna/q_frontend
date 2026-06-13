import type {
  CandidateResult,
  StrategySearchResults,
  StrategySearchRunSummary,
  StrategySearchStatus,
} from '@/types/strategySearch'
import type { WalkForwardEquityPoint } from '@/types/walkforward'

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

const mockEquityCurve: WalkForwardEquityPoint[] = [
  { time: '2023-07-01T00:00:00Z', equity: 100000 },
  { time: '2023-08-01T00:00:00Z', equity: 104500 },
  { time: '2023-09-01T00:00:00Z', equity: 108200 },
  { time: '2023-10-01T00:00:00Z', equity: 111800 },
]

const mockCandidates: CandidateResult[] = [
  {
    candidate_id: 'MACrossover',
    strategy: 'MACrossover',
    status: 'completed',
    rank: 1,
    objective_value: 1.42,
    robustness_score: 1.42,
    efficiency: 0.68,
    gate_flags: [],
    passed_gates: true,
    oos_metrics: {
      total_pnl: 11800,
      sharpe_ratio: 1.05,
      max_drawdown_pct: 0.09,
      return_drawdown_ratio: 1.42,
      total_trades: 24,
    },
    is_metrics_summary: { mean_objective: 2.08, window_count: 3 },
    best_params: { short_period: 8, long_period: 21, quantity: 1.2 },
    window_count: 3,
    completed_windows: 3,
    error: null,
  },
  {
    candidate_id: 'VMA',
    strategy: 'VMA',
    status: 'completed',
    rank: 2,
    objective_value: 0.91,
    robustness_score: 0.91,
    efficiency: 0.52,
    gate_flags: [],
    passed_gates: true,
    oos_metrics: {
      total_pnl: 6200,
      sharpe_ratio: 0.72,
      max_drawdown_pct: 0.11,
      return_drawdown_ratio: 0.91,
      total_trades: 19,
    },
    is_metrics_summary: { mean_objective: 1.75, window_count: 3 },
    best_params: { period: 14, quantity: 1.0 },
    window_count: 3,
    completed_windows: 3,
    error: null,
  },
  {
    candidate_id: 'RSIMeanReversion',
    strategy: 'RSIMeanReversion',
    status: 'completed',
    rank: null,
    objective_value: 0.45,
    robustness_score: 0.45,
    efficiency: 0.22,
    gate_flags: ['low_efficiency'],
    passed_gates: false,
    oos_metrics: {
      total_pnl: 2100,
      sharpe_ratio: 0.35,
      max_drawdown_pct: 0.14,
      return_drawdown_ratio: 0.45,
      total_trades: 12,
    },
    is_metrics_summary: { mean_objective: 2.05, window_count: 3 },
    best_params: { rsi_period: 14, quantity: 1.0 },
    window_count: 3,
    completed_windows: 3,
    error: null,
  },
  {
    candidate_id: 'TickScalper',
    strategy: 'TickScalper',
    status: 'unsupported',
    rank: null,
    objective_value: null,
    robustness_score: null,
    efficiency: null,
    gate_flags: [],
    passed_gates: false,
    oos_metrics: null,
    is_metrics_summary: null,
    best_params: null,
    window_count: 0,
    completed_windows: 0,
    error: 'Tick-engine strategies are not supported for walk-forward search',
  },
  {
    candidate_id: 'BollingerReversion',
    strategy: 'BollingerReversion',
    status: 'no_result',
    rank: null,
    objective_value: null,
    robustness_score: null,
    efficiency: null,
    gate_flags: [],
    passed_gates: false,
    oos_metrics: null,
    is_metrics_summary: null,
    best_params: null,
    window_count: 3,
    completed_windows: 0,
    error: 'zero out-of-sample trades',
  },
]

export const mockStrategySearchRunSummaries: StrategySearchRunSummary[] = [
  {
    run_id: 'ss-run-petr4',
    name: 'PETR4 discovery',
    status: 'completed',
    symbol: 'PETR4',
    candidate_count: 5,
    best_strategy: 'MACrossover',
    best_objective_value: 1.42,
    created_at: hoursAgo(6),
  },
  {
    run_id: 'ss-run-win',
    name: 'WIN$ sweep',
    status: 'failed',
    symbol: 'WIN$',
    candidate_count: 0,
    best_strategy: null,
    best_objective_value: null,
    created_at: hoursAgo(36),
  },
]

export const mockStrategySearchStatuses: Record<string, StrategySearchStatus> = {
  'ss-run-petr4': {
    run_id: 'ss-run-petr4',
    status: 'completed',
    current_candidate: 5,
    total_candidates: 5,
    candidate_id: 'BollingerReversion',
    strategy: 'BollingerReversion',
    phase: null,
    window_index: null,
    total_windows: null,
    error: null,
    backtest_config: {
      symbol: 'PETR4',
      timeframe: 'D1',
      start: '2023-01-01T00:00:00Z',
      end: '2023-12-31T00:00:00Z',
      initial_capital: 100000,
      point_value: 1,
      strategy: 'MACrossover',
    },
    search_config: {
      backtest: {
        symbol: 'PETR4',
        timeframe: 'D1',
        start: '2023-01-01T00:00:00Z',
        end: '2023-12-31T00:00:00Z',
        initial_capital: 100000,
        point_value: 1,
        strategy: 'MACrossover',
      },
      objective: { mode: 'maximize_return_drawdown' },
      walkforward: { train_days: 180, test_days: 30, mode: 'rolling', min_windows: 2 },
      study: { name: 'PETR4 discovery', n_trials: 20, seed: 42, pruner: 'none' },
      strategies: null,
    },
  },
  'ss-run-win': {
    run_id: 'ss-run-win',
    status: 'failed',
    current_candidate: 0,
    total_candidates: 0,
    candidate_id: null,
    strategy: null,
    phase: null,
    window_index: null,
    total_windows: null,
    error: 'Date range yields 1 walk-forward window(s), but min_windows is 2.',
    backtest_config: {
      symbol: 'WIN$',
      timeframe: 'D1',
      start: '2024-01-01T00:00:00Z',
      end: '2024-06-01T00:00:00Z',
      initial_capital: 100000,
      point_value: 0.2,
      strategy: 'MACrossover',
    },
  },
}

export const mockStrategySearchResults: Record<string, StrategySearchResults> = {
  'ss-run-petr4': {
    run_id: 'ss-run-petr4',
    status: 'completed',
    objective_mode: 'maximize_return_drawdown',
    summary: {
      objective_mode: 'maximize_return_drawdown',
      candidate_count: 5,
      ranked_count: 2,
      passed_gates_count: 2,
      best_candidate_id: 'MACrossover',
      best_strategy: 'MACrossover',
      best_objective_value: 1.42,
      best_efficiency: 0.68,
    },
    candidates: mockCandidates,
    best: mockCandidates[0],
    search_config: mockStrategySearchStatuses['ss-run-petr4'].search_config,
  },
}

export function getMockStrategySearchStatus(runId: string): StrategySearchStatus | null {
  return mockStrategySearchStatuses[runId] ?? null
}

export function getMockStrategySearchResults(runId: string): StrategySearchResults | null {
  return mockStrategySearchResults[runId] ?? null
}

type MockStrategySearchJob = {
  run_id: string
  status: StrategySearchStatus['status']
  total_candidates: number
  start_time: number
  request_body: unknown
}

export const mockStrategySearchJobs = new Map<string, MockStrategySearchJob>()
export const deletedStrategySearchRunIds = new Set<string>()

export function resetMockStrategySearchState() {
  mockStrategySearchJobs.clear()
  deletedStrategySearchRunIds.clear()
}

export function getUpdatedStrategySearchJob(runId: string): MockStrategySearchJob | undefined {
  const job = mockStrategySearchJobs.get(runId)
  if (!job) return undefined
  if (job.status === 'cancelled' || job.status === 'completed' || job.status === 'failed') {
    return job
  }

  const elapsed = Date.now() - job.start_time
  if (elapsed < 800) {
    job.status = 'pending'
  } else if (elapsed < 8000) {
    job.status = 'running'
  } else {
    job.status = 'completed'
  }
  return job
}

export function strategySearchStatusFromJob(job: MockStrategySearchJob): StrategySearchStatus {
  const elapsed = Date.now() - job.start_time
  let current_candidate = 0
  let candidate_id: string | null = null
  let strategy: string | null = null
  let phase: StrategySearchStatus['phase'] = 'optimizing'
  let window_index: number | null = null
  let total_windows: number | null = job.total_candidates > 0 ? 3 : null

  if (job.status === 'pending') {
    current_candidate = 0
    phase = 'optimizing'
  } else if (job.status === 'running') {
    const progress = Math.min(1, (elapsed - 800) / 7200)
    current_candidate = Math.min(
      job.total_candidates,
      Math.max(1, Math.ceil(progress * job.total_candidates)),
    )
    const strategies = ['MACrossover', 'VMA', 'RSIMeanReversion']
    strategy = strategies[(current_candidate - 1) % strategies.length] ?? 'MACrossover'
    candidate_id = strategy
    window_index = Math.min(2, Math.floor((progress * job.total_candidates * 3) % 3))
    phase = progress > 0.45 ? 'testing' : 'optimizing'
  } else if (job.status === 'completed') {
    current_candidate = job.total_candidates
    candidate_id = 'BollingerReversion'
    strategy = 'BollingerReversion'
    phase = null
    window_index = null
    total_windows = null
  }

  const body = job.request_body as { backtest?: StrategySearchStatus['backtest_config'] }

  return {
    run_id: job.run_id,
    status: job.status,
    current_candidate,
    total_candidates: job.total_candidates,
    candidate_id,
    strategy,
    phase,
    window_index,
    total_windows,
    error: null,
    search_config: job.request_body as StrategySearchStatus['search_config'],
    backtest_config: body?.backtest,
  }
}

export function strategySearchResultsFromJob(job: MockStrategySearchJob): StrategySearchResults {
  const body = job.request_body as StrategySearchResults['search_config']

  return {
    run_id: job.run_id,
    status: job.status === 'cancelled' ? 'cancelled' : 'completed',
    objective_mode: body?.objective.mode ?? 'maximize_return_drawdown',
    summary: mockStrategySearchResults['ss-run-petr4'].summary,
    candidates: mockCandidates.slice(0, Math.max(2, job.total_candidates)),
    best: mockCandidates[0],
    search_config: body,
  }
}

export function getMockCandidateEquityPoints(
  _runId: string,
  candidateId: string,
): WalkForwardEquityPoint[] {
  if (candidateId === 'TickScalper' || candidateId === 'BollingerReversion') {
    return []
  }
  return mockEquityCurve
}
