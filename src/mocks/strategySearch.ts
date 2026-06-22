import type {
  CandidateResult,
  Genome,
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
    candidate_id: 'MACrossover__exit_chandelier',
    strategy: 'MACrossover',
    status: 'completed',
    rank: 3,
    objective_value: 0.82,
    robustness_score: 0.82,
    efficiency: 0.48,
    gate_flags: [],
    passed_gates: true,
    oos_metrics: {
      total_pnl: 5400,
      sharpe_ratio: 0.68,
      max_drawdown_pct: 0.1,
      return_drawdown_ratio: 0.82,
      total_trades: 17,
    },
    is_metrics_summary: { mean_objective: 1.62, window_count: 3 },
    best_params: {
      short_period: 8,
      long_period: 21,
      quantity: 1.0,
      chandelier_atr_mult: 2.5,
    },
    window_count: 3,
    completed_windows: 3,
    error: null,
    exit_preset_id: 'chandelier',
    exit_preset_label: 'Chandelier trail',
    exit_quality: {
      total_closed_trades: 17,
      by_reason: {
        fixed_sl: { trades: 5, total_pnl: -1200, win_rate: 0 },
        chandelier: { trades: 9, total_pnl: 6800, win_rate: 0.67 },
        signal: { trades: 3, total_pnl: 600, win_rate: 0.4 },
      },
      holding_period: { median_bars: 8, p90_bars: 24 },
      path_quality: {
        avg_mfe_capture_ratio: 0.47,
        avg_profit_giveback: 310,
        avg_mae: -180,
      },
    },
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

export const mockSampleGenome: Genome = {
  version: 1,
  genome_id: 'genome-champion-001',
  nodes: [
    { id: 'n1', kind: 'SMA', params: { period: { param: 'sma_period' } }, inputs: [] },
    { id: 'n2', kind: 'SMA', params: { period: 50 }, inputs: [] },
    {
      id: 'n3',
      kind: 'CrossAbove',
      params: {},
      inputs: ['n1', 'n2'],
    },
  ],
  entry_long: { ref: 'n3' },
  exit_long: { ref: 'n2' },
  metadata: { generation: 5 },
}

const mockGeneticCandidates: CandidateResult[] = [
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
    oos_metrics: {
      total_pnl: 9200,
      sharpe_ratio: 0.88,
      max_drawdown_pct: 0.08,
      return_drawdown_ratio: 1.28,
      total_trades: 18,
    },
    is_metrics_summary: { mean_objective: 1.95, window_count: 3 },
    best_params: {
      strategy_params: { sma_period: 12 },
      quantity: 1.0,
    },
    window_count: 3,
    completed_windows: 3,
    error: null,
    generation: 5,
    genome: mockSampleGenome,
    genome_node_count: 3,
    dsr: 0.62,
    complexity_penalty: 0.002,
    exit_policy_id: 'atr_stop_chandelier',
    exit_policy_label: 'ATR stop + Chandelier trail',
    exit_quality: {
      total_closed_trades: 18,
      by_reason: {
        fixed_sl: { trades: 4, total_pnl: -900, win_rate: 0 },
        chandelier: { trades: 10, total_pnl: 8200, win_rate: 0.6 },
        signal: { trades: 4, total_pnl: 1900, win_rate: 0.5 },
      },
      holding_period: { median_bars: 11, p90_bars: 28 },
      path_quality: {
        avg_mfe_capture_ratio: 0.52,
        avg_profit_giveback: 240,
        avg_mae: -150,
      },
    },
  },
  {
    candidate_id: 'genome-gen4-002',
    strategy: 'CompositeStrategy',
    status: 'completed',
    rank: 2,
    objective_value: 0.95,
    robustness_score: 0.95,
    efficiency: 0.55,
    gate_flags: [],
    passed_gates: true,
    oos_metrics: {
      total_pnl: 5100,
      sharpe_ratio: 0.61,
      max_drawdown_pct: 0.1,
      return_drawdown_ratio: 0.95,
      total_trades: 14,
    },
    is_metrics_summary: { mean_objective: 1.72, window_count: 3 },
    best_params: { strategy_params: { rsi_period: 10 }, quantity: 1.0 },
    window_count: 3,
    completed_windows: 3,
    error: null,
    generation: 4,
    genome: {
      ...mockSampleGenome,
      genome_id: 'genome-gen4-002',
      metadata: { generation: 4 },
    },
    genome_node_count: 4,
    dsr: 0.41,
  },
  {
    candidate_id: 'genome-gen3-003',
    strategy: 'CompositeStrategy',
    status: 'completed',
    rank: null,
    objective_value: 0.38,
    robustness_score: 0.38,
    efficiency: 0.18,
    gate_flags: ['low_efficiency'],
    passed_gates: false,
    oos_metrics: {
      total_pnl: 800,
      sharpe_ratio: 0.22,
      max_drawdown_pct: 0.15,
      return_drawdown_ratio: 0.38,
      total_trades: 9,
    },
    is_metrics_summary: { mean_objective: 1.6, window_count: 3 },
    best_params: { strategy_params: { period: 20 }, quantity: 1.0 },
    window_count: 3,
    completed_windows: 3,
    error: null,
    generation: 3,
    genome_node_count: 5,
    dsr: 0.12,
  },
]

export const mockStrategySearchRunSummaries: StrategySearchRunSummary[] = [
  {
    run_id: 'ss-run-genetic',
    name: 'PETR4 genetic synthesis',
    status: 'completed',
    symbol: 'PETR4',
    candidate_count: 3,
    best_strategy: 'CompositeStrategy',
    best_objective_value: 1.28,
    created_at: hoursAgo(2),
  },
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
  'ss-run-genetic': {
    run_id: 'ss-run-genetic',
    status: 'completed',
    current_candidate: 40,
    total_candidates: 40,
    candidate_id: 'genome-champion-001',
    strategy: 'CompositeStrategy',
    phase: null,
    window_index: null,
    total_windows: null,
    generation: 5,
    total_generations: 5,
    error: null,
    backtest_config: {
      symbol: 'PETR4',
      timeframe: 'D1',
      start: '2023-01-01T00:00:00Z',
      end: '2023-12-31T00:00:00Z',
      initial_capital: 100000,
      point_value: 1,
      strategy: 'CompositeStrategy',
    },
    search_config: {
      backtest: {
        symbol: 'PETR4',
        timeframe: 'D1',
        start: '2023-01-01T00:00:00Z',
        end: '2023-12-31T00:00:00Z',
        initial_capital: 100000,
        point_value: 1,
        strategy: 'CompositeStrategy',
      },
      objective: { mode: 'maximize_return_drawdown' },
      walkforward: { train_days: 180, test_days: 30, mode: 'rolling', min_windows: 2 },
      study: { name: 'PETR4 genetic', n_trials: 20, seed: 42, pruner: 'none' },
      strategies: null,
      genetic: {
        population_size: 8,
        generations: 5,
        elite_count: 2,
        crossover_rate: 0.7,
        mutation_rate: 0.15,
        tournament_size: 3,
        init_seed: 42,
        max_nodes: 24,
        max_depth: 12,
        complexity_lambda: 0.001,
        complexity_mu: 0.0005,
      },
      lockbox: {
        enabled: true,
        lockbox_pct: 0.15,
        lockbox_days: null,
        min_trades: 5,
        max_drawdown_pct: null,
      },
    },
  },
  'ss-run-petr4': {
    run_id: 'ss-run-petr4',
    status: 'completed',
    current_candidate: 6,
    total_candidates: 6,
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
  'ss-run-genetic': {
    run_id: 'ss-run-genetic',
    status: 'completed',
    objective_mode: 'maximize_return_drawdown',
    summary: {
      objective_mode: 'maximize_return_drawdown',
      candidate_count: 3,
      ranked_count: 2,
      passed_gates_count: 2,
      best_candidate_id: 'genome-champion-001',
      best_strategy: 'CompositeStrategy',
      best_objective_value: 1.28,
      best_efficiency: 0.71,
      generations_completed: 5,
      total_genomes_evaluated: 40,
      champion_dsr: 0.62,
      n_trials_effective: 40,
      sr_observed: 0.88,
      lockbox_metrics: {
        sharpe_ratio: 0.35,
        total_trades: 6,
        max_drawdown_pct: 0.11,
      },
      lockbox_passed: true,
    },
    candidates: mockGeneticCandidates,
    best: mockGeneticCandidates[0],
    search_config: mockStrategySearchStatuses['ss-run-genetic'].search_config,
  },
  'ss-run-petr4': {
    run_id: 'ss-run-petr4',
    status: 'completed',
    objective_mode: 'maximize_return_drawdown',
    summary: {
      objective_mode: 'maximize_return_drawdown',
      candidate_count: 6,
      ranked_count: 3,
      passed_gates_count: 3,
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
  total_generations?: number
  start_time: number
  request_body: unknown
  is_genetic?: boolean
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
  let generation: number | null = null
  const total_generations: number | null = job.total_generations ?? null

  if (job.status === 'pending') {
    current_candidate = 0
    phase = 'optimizing'
  } else if (job.status === 'running') {
    const progress = Math.min(1, (elapsed - 800) / 7200)
    current_candidate = Math.min(
      job.total_candidates,
      Math.max(1, Math.ceil(progress * job.total_candidates)),
    )
    if (job.is_genetic && total_generations) {
      generation = Math.min(total_generations, Math.max(1, Math.ceil(progress * total_generations)))
      strategy = 'CompositeStrategy'
      candidate_id = `genome-gen${generation}-001`
    } else {
      const strategies = ['MACrossover', 'VMA', 'RSIMeanReversion']
      strategy = strategies[(current_candidate - 1) % strategies.length] ?? 'MACrossover'
      candidate_id = strategy
    }
    window_index = Math.min(2, Math.floor((progress * job.total_candidates * 3) % 3))
    phase = progress > 0.45 ? 'testing' : 'optimizing'
  } else if (job.status === 'completed') {
    current_candidate = job.total_candidates
    if (job.is_genetic) {
      candidate_id = 'genome-champion-001'
      strategy = 'CompositeStrategy'
      generation = total_generations
    } else {
      candidate_id = 'BollingerReversion'
      strategy = 'BollingerReversion'
    }
    phase = null
    window_index = null
    total_windows = null
  }

  const body = job.request_body as { backtest?: StrategySearchStatus['backtest_config'] }

  const logs: string[] = []
  if (job.status === 'running' || job.status === 'completed') {
    const numLogs = job.status === 'completed' ? job.total_candidates : current_candidate
    for (let i = 1; i <= numLogs; i++) {
      const dateStr = new Date(job.start_time + i * 500).toISOString()
      const datePart = dateStr.slice(0, 10)
      const timePart = dateStr.slice(11, 23).replace('.', ',')
      const ts = `${datePart} ${timePart}`
      const cId = job.is_genetic ? `gen${Math.ceil(i / 24)}-rand-${i}` : `candidate-${i}`
      logs.push(
        `[I ${ts}] Candidate ${cId} - Window 0 - Trial ${i} finished with value: ${(5 + Math.sin(i) * 2).toFixed(4)} and parameters: {'period': ${10 + i * 2}, 'threshold': ${(50 + i * 0.5).toFixed(2)}}. Best is trial 0 with value: 6.4410.`,
      )
    }
  }

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
    generation,
    total_generations,
    error: null,
    search_config: job.request_body as StrategySearchStatus['search_config'],
    backtest_config: body?.backtest,
    logs,
  }
}

export function strategySearchResultsFromJob(job: MockStrategySearchJob): StrategySearchResults {
  const body = job.request_body as StrategySearchResults['search_config']

  if (job.is_genetic) {
    return {
      run_id: job.run_id,
      status: job.status === 'cancelled' ? 'cancelled' : 'completed',
      objective_mode: body?.objective.mode ?? 'maximize_return_drawdown',
      summary: mockStrategySearchResults['ss-run-genetic'].summary,
      candidates: mockGeneticCandidates,
      best: mockGeneticCandidates[0],
      search_config: body,
    }
  }

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

export function getMockCandidateGenome(_runId: string, candidateId: string): Genome | null {
  const genetic = mockGeneticCandidates.find((c) => c.candidate_id === candidateId)
  if (genetic?.genome) return genetic.genome
  if (candidateId === 'genome-gen3-003') {
    return {
      ...mockSampleGenome,
      genome_id: candidateId,
      metadata: { generation: 3 },
    }
  }
  return null
}
