import type {
  ObjectiveConfig,
  ObjectiveMode,
  OptimizationBacktestConfig,
  StudyConfig,
} from '@/types/optimization'
import type { WalkForwardConfig, WalkForwardEquityPoint } from '@/types/walkforward'

export type GateConfig = {
  min_completed_windows: number
  min_oos_trades: number
  efficiency_low: number
  efficiency_high: number
}

export type StrategySearchConfig = {
  backtest: OptimizationBacktestConfig
  objective: ObjectiveConfig
  walkforward: WalkForwardConfig
  study: StudyConfig
  /** Omit or null = all candle strategies. */
  strategies?: string[] | null
  include_risk_search?: boolean
  gates?: GateConfig
}

export type StrategySearchJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type StrategySearchPhase = 'optimizing' | 'testing' | 'done'

export type StrategySearchStartResponse = {
  run_id: string
  status: StrategySearchJobStatus
}

export type StrategySearchStatus = {
  run_id: string
  status: StrategySearchJobStatus
  current_candidate: number
  total_candidates: number
  candidate_id: string | null
  strategy: string | null
  phase: StrategySearchPhase | null
  window_index: number | null
  total_windows: number | null
  error: string | null
  search_config?: StrategySearchConfig
  backtest_config?: OptimizationBacktestConfig
}

export type CandidateStatus = 'completed' | 'no_result' | 'unsupported' | 'error'

export type IsMetricsSummary = {
  mean_objective: number
  window_count: number
}

export type CandidateResult = {
  candidate_id: string
  strategy: string
  status: CandidateStatus
  rank: number | null
  objective_value: number | null
  robustness_score: number | null
  efficiency: number | null
  gate_flags: string[]
  passed_gates: boolean
  oos_metrics: Record<string, number> | null
  is_metrics_summary: IsMetricsSummary | null
  best_params: Record<string, unknown> | null
  window_count: number
  completed_windows: number
  error: string | null
}

export type StrategySearchSummary = {
  objective_mode: ObjectiveMode
  candidate_count: number
  ranked_count: number
  passed_gates_count: number
  best_candidate_id: string | null
  best_strategy: string | null
  best_objective_value: number | null
  best_efficiency: number | null
}

export type StrategySearchResults = {
  run_id: string
  status: StrategySearchJobStatus
  objective_mode: ObjectiveMode
  summary: StrategySearchSummary
  candidates: CandidateResult[]
  best: CandidateResult | null
  search_config?: StrategySearchConfig
  lake_paths?: Record<string, string>
}

export type StrategySearchRunSummary = {
  run_id: string
  name: string
  status: StrategySearchJobStatus
  symbol: string | null
  candidate_count: number
  best_strategy: string | null
  best_objective_value: number | null
  created_at: string
}

export type StrategySearchRunListResponse = {
  items: StrategySearchRunSummary[]
  total: number
  limit: number
  offset: number
}

export type StrategySearchCandidateEquityArtifact = {
  run_id: string
  candidate_id: string
  points: WalkForwardEquityPoint[]
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  min_completed_windows: 2,
  min_oos_trades: 10,
  efficiency_low: 0.3,
  efficiency_high: 1.5,
}

export function isStrategySearchTerminalStatus(
  status: StrategySearchJobStatus | undefined,
): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

export function shouldFetchStrategySearchResults(
  status: StrategySearchJobStatus | undefined,
): boolean {
  return status === 'completed' || status === 'cancelled'
}
