import type {
  ObjectiveConfig,
  ObjectiveMode,
  OptimizationBacktestConfig,
  StudyConfig,
} from '@/types/optimization'
import type { WalkForwardConfig, WalkForwardEquityPoint } from '@/types/walkforward'

export type SearchProvider = 'registry' | 'genetic'

export type GateConfig = {
  min_completed_windows: number
  min_oos_trades: number
  efficiency_low: number
  efficiency_high: number
}

export type GeneticSearchConfig = {
  population_size: number
  generations: number
  elite_count: number
  crossover_rate: number
  mutation_rate: number
  tournament_size: number
  init_seed?: number | null
  max_nodes: number
  max_depth: number
  complexity_lambda: number
  complexity_mu: number
}

export type LockboxConfig = {
  enabled: boolean
  lockbox_pct?: number | null
  lockbox_days?: number | null
  min_trades: number
  max_drawdown_pct?: number | null
}

export type NodeParam = string | number | { param: string }

export type GenomeNode = {
  id: string
  kind: string
  params?: Record<string, NodeParam>
  inputs?: string[]
}

export type Genome = {
  version: number
  genome_id: string
  nodes: GenomeNode[]
  entry_long: { ref: string }
  entry_short?: { ref: string }
  exit_long: { ref: string }
  exit_short?: { ref: string }
  metadata?: {
    generation?: number
    parent_ids?: string[]
  }
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
  genetic?: GeneticSearchConfig | null
  lockbox?: LockboxConfig
  provider?: SearchProvider
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
  generation?: number | null
  total_generations?: number | null
  error: string | null
  search_config?: StrategySearchConfig
  backtest_config?: OptimizationBacktestConfig
  logs?: string[]
}

export type CandidateStatus = 'completed' | 'no_result' | 'unsupported' | 'error'

export type IsMetricsSummary = {
  mean_objective: number
  window_count: number
}

export type ExitQualityByReason = {
  trades: number
  total_pnl?: number | null
  win_rate?: number | null
  avg_pnl?: number | null
}

export type ExitQualitySummary = {
  total_closed_trades?: number
  by_reason?: Record<string, ExitQualityByReason>
  holding_period?: {
    median_bars?: number | null
    p90_bars?: number | null
    median_minutes?: number | null
    median_duration_seconds?: number | null
    p90_duration_seconds?: number | null
  }
  path_quality?: {
    avg_mfe_capture_ratio?: number | null
    avg_profit_giveback?: number | null
    avg_mae?: number | null
  }
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
  generation?: number | null
  genome?: Genome | null
  genome_node_count?: number | null
  dsr?: number | null
  complexity_penalty?: number | null
  exit_preset_id?: string | null
  exit_preset_label?: string | null
  exit_policy_id?: string | null
  exit_policy_label?: string | null
  last_exit_mutation_op?: string | null
  exit_quality?: ExitQualitySummary | null
  diagnostics?: { exit_quality?: ExitQualitySummary | null } | null
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
  generations_completed?: number | null
  total_genomes_evaluated?: number | null
  champion_dsr?: number | null
  n_trials_effective?: number | null
  sr_observed?: number | null
  lockbox_metrics?: Record<string, number> | null
  lockbox_passed?: boolean | null
}

export type StrategySearchResults = {
  run_id: string
  status: StrategySearchJobStatus
  objective_mode: ObjectiveMode
  summary: StrategySearchSummary
  candidates: CandidateResult[]
  best: CandidateResult | null
  search_config?: StrategySearchConfig
  lake_paths?: Record<string, unknown>
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

export type StrategySearchCandidateGenomeArtifact = {
  run_id: string
  candidate_id: string
  genome: Genome
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  min_completed_windows: 2,
  min_oos_trades: 10,
  efficiency_low: 0.3,
  efficiency_high: 1.5,
}

export const DEFAULT_GENETIC_CONFIG: GeneticSearchConfig = {
  population_size: 40,
  generations: 10,
  elite_count: 4,
  crossover_rate: 0.7,
  mutation_rate: 0.15,
  tournament_size: 3,
  init_seed: 42,
  max_nodes: 24,
  max_depth: 12,
  complexity_lambda: 0.001,
  complexity_mu: 0.0005,
}

export const DEFAULT_LOCKBOX_CONFIG: LockboxConfig = {
  enabled: true,
  lockbox_pct: 0.15,
  lockbox_days: null,
  min_trades: 5,
  max_drawdown_pct: null,
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

export function isGeneticSearchConfig(config: StrategySearchConfig | undefined): boolean {
  if (!config) return false
  return config.provider === 'genetic' || config.genetic != null
}

export function isGeneticCandidate(candidate: CandidateResult): boolean {
  return candidate.strategy === 'CompositeStrategy' || candidate.genome != null
}

export function hasGeneticSummary(summary: StrategySearchSummary | undefined): boolean {
  if (!summary) return false
  return (
    summary.generations_completed != null ||
    summary.champion_dsr != null ||
    summary.total_genomes_evaluated != null
  )
}

export function maxCandidateGeneration(candidates: CandidateResult[]): number | null {
  let max: number | null = null
  for (const candidate of candidates) {
    if (candidate.generation == null) continue
    max = max == null ? candidate.generation : Math.max(max, candidate.generation)
  }
  return max
}

export function countGenomeParams(genome: Genome): number {
  let count = 0
  for (const node of genome.nodes) {
    if (!node.params) continue
    for (const value of Object.values(node.params)) {
      if (typeof value === 'object' && value !== null && 'param' in value) {
        count += 1
      }
    }
  }
  return count
}
