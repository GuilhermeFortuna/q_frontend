import type { StrategySearchConfig } from '@/types/strategySearch'
import type { WalkForwardConfig } from '@/types/walkforward'

export const DEFAULT_MINIMUM_COMPLETE_PAIRS = 2

export type DiscoveryAbRequest = {
  config: StrategySearchConfig
  seeds: number[]
  minimum_complete_pairs?: number
}

export type DiscoveryAbArmSummary = {
  values: number[]
  mean: number | null
}

export type DiscoveryAbPairedDelta = {
  values: number[]
  mean: number | null
  cohens_d: number | null
  p_value: number | null
}

export type DiscoveryAbVerdict = 'helps' | 'no_effect' | 'hurts' | 'inconclusive'

export type DiscoveryAbResult = {
  verdict: DiscoveryAbVerdict
  n_seeds: number
  requested_seeds: number
  complete_pairs: number
  minimum_complete_pairs: number
  dropped_pair_reasons: string[]
  metric: 'lockbox_objective' | 'oos_objective'
  control: DiscoveryAbArmSummary
  treatment: DiscoveryAbArmSummary
  paired_delta: DiscoveryAbPairedDelta
  child_runs: Record<string, unknown>[]
}

export type DiscoveryAbStartResponse = {
  job_id: string
  status: string
}

export type DiscoveryAbStatusResponse = {
  job_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress: number
  detail?: string | null
  result?: DiscoveryAbResult | null
  error?: string | null
}

export type EncoderConfigSpec = {
  label: string
  encoder_kind: 'pca' | 'ae'
  hyperparams?: Record<string, unknown>
}

export type EncoderAblationRequest = {
  symbol: string
  timeframe: string
  target: string
  horizon: number
  train_start: string
  train_end: string
  n_latents: number
  input_features: string[]
  configs: EncoderConfigSpec[]
}

export type EncoderAblationRow = {
  label: string
  encoder_kind: 'pca' | 'ae'
  model_hash?: string | null
  recon_r2?: number | null
  best_latent_ic?: number | null
  baseline_ic?: number | null
  ic_delta_vs_baseline?: number | null
  passed?: boolean | null
  gate_error?: string | null
}

export type EncoderAblationResult = {
  rows: EncoderAblationRow[]
  best_label?: string | null
  symbol: string
  timeframe: string
  target: string
  horizon: number
}

export type EncoderAblationStartResponse = {
  job_id: string
  status: string
}

export type EncoderAblationStatusResponse = {
  job_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress?: string | null
  result?: EncoderAblationResult | null
  error?: string | null
}

export type AlphaResearchProfileId = 'ccm_h1_swing' | 'win_h1_swing' | 'wdo_m15_day'

export type AlphaResearchVerdict = 'ready_for_paper' | 'inconclusive' | 'rejected'

export type AlphaResearchComputeBudget = {
  study_n_trials?: number
  optimization_seeds?: number
  walkforward?: WalkForwardConfig
}

export type AlphaResearchRequest = {
  profile_id: AlphaResearchProfileId
  start: string
  end: string
  catalog_version?: number
  profile_version?: number
  target_name?: string
  compute_budget?: AlphaResearchComputeBudget
}

export type AlphaResearchStageName =
  | 'preflight'
  | 'feature_evidence'
  | 'hypothesis_eligibility'
  | 'candidate_evaluation'
  | 'acceptance'
  | 'lockbox'
  | 'complete'

export type AlphaResearchStageStatus = {
  name: AlphaResearchStageName
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  detail?: string | null
}

export type AlphaResearchFeatureEvidenceRow = {
  feature_name: string
  feature_id?: string
  decision: 'admitted' | 'rejected' | 'inconclusive' | string
  deflated_score?: number | null
  n_obs?: number | null
}

export type AlphaResearchHypothesisRow = {
  candidate_id: string
  hypothesis_id?: string
  hypothesis_rationale?: string
  hypothesis_required_features?: string[]
  genome_node_count?: number
}

export type AlphaResearchCriterionRow = {
  name: string
  status: 'passed' | 'failed' | 'unavailable' | string
  observed: unknown
  threshold: unknown
  reason: string
}

export type AlphaResearchSeedRow = {
  seed: number
  status: 'completed' | 'failed' | 'missing' | string
  objective_value?: number | null
  completed_windows?: number
  window_count?: number
  window_returns?: number[]
  oos_metrics?: Record<string, unknown> | null
  failure_reason?: string | null
}

export type AlphaResearchPlateauSummary = {
  neighbors_evaluated?: number
  profitable_fraction?: number | null
  score_retention?: number | null
  champion_objective?: number | null
  neighbors?: Array<{
    params?: Record<string, unknown>
    objective_value?: number | null
    profitable?: boolean
  }>
}

export type AlphaResearchAcceptanceResult = {
  acceptance_id?: string
  candidate_id?: string
  verdict?: AlphaResearchVerdict
  criteria?: AlphaResearchCriterionRow[]
  seeds?: AlphaResearchSeedRow[]
  plateau?: AlphaResearchPlateauSummary | null
  dsr_value?: number | null
  effective_attempt_count?: number
  lockbox_metrics?: Record<string, unknown> | null
  tail_diagnostics?: Record<string, unknown> | null
  champion_seed?: number | null
  champion_hash?: string | null
  manifest_hash?: string | null
}

export type AlphaResearchChampion = {
  candidate_id: string
  champion_seed?: number | null
  best_params?: Record<string, unknown> | null
  genome?: Record<string, unknown> | null
  hypothesis?: Record<string, unknown>
}

export type AlphaResearchResult = {
  verdict: AlphaResearchVerdict
  profile_id: AlphaResearchProfileId
  provenance: Record<string, unknown>
  split_manifest?: Record<string, unknown> | null
  feature_evidence_summary: AlphaResearchFeatureEvidenceRow[]
  hypothesis_manifest: AlphaResearchHypothesisRow[]
  champion?: AlphaResearchChampion | null
  acceptance?: AlphaResearchAcceptanceResult | null
  stages: AlphaResearchStageStatus[]
  inconclusive_reasons: string[]
  coverage: Record<string, unknown>
}

export type AlphaResearchStartResponse = {
  job_id: string
  status: string
}

export type AlphaResearchStatusResponse = {
  job_id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  detail?: string | null
  stages?: AlphaResearchStageStatus[]
  result?: AlphaResearchResult | null
  error?: string | null
  checkpoint?: Record<string, unknown> | null
}
