import type { StrategySearchConfig } from '@/types/strategySearch'

export type DiscoveryAbRequest = {
  config: StrategySearchConfig
  seeds: number[]
}

export type DiscoveryAbArmSummary = {
  values: number[]
  mean: number
}

export type DiscoveryAbPairedDelta = {
  values: number[]
  mean: number
  cohens_d: number
  p_value: number
}

export type DiscoveryAbResult = {
  verdict: 'helps' | 'no_effect' | 'hurts'
  n_seeds: number
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
