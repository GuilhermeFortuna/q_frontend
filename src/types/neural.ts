export type NeuralModelStatus = 'trained' | 'candidate' | 'production' | 'archived'

export type LatentGateResult = {
  evaluation_run_id: string
  baseline_ic: number
  best_latent_ic: number
  n_latents_beating_baseline: number
  passed: boolean
  target_name?: string | null
  target_horizon?: number | null
}

export type NeuralValMetrics = {
  reconstruction_r2?: number | null
  reconstruction_mse?: number | null
  [key: string]: unknown
}

export type NeuralModelListItem = {
  model_hash: string
  model_key: string
  symbol: string
  timeframe: string
  version: number
  status: NeuralModelStatus
  n_latents: number
  created_at: string
  val_metrics: NeuralValMetrics
}

export type NeuralModelListResponse = {
  models: NeuralModelListItem[]
}

export type NeuralModelDetail = NeuralModelListItem & {
  train_start: string
  train_end: string
  latent_names: string[]
  gate_result: LatentGateResult | null
}

export type NeuralModelStatusUpdateRequest = {
  status: NeuralModelStatus
}

export type NeuralEncoderKind = 'pca' | 'autoencoder'

export type NeuralTrainEvaluateRequest = {
  target: string
  horizon: number
}

export type NeuralTrainRequest = {
  kind: NeuralEncoderKind
  symbol: string
  timeframe: string
  train_start: string
  train_end: string
  n_latents: number
  input_features: string[]
  model_key?: string | null
  evaluate?: NeuralTrainEvaluateRequest | null
  hyperparams?: Record<string, unknown>
}

export type NeuralTrainStartResponse = {
  job_id: string
  status: string
}

export type NeuralTrainingJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export type NeuralTrainingProgress =
  | 'queued'
  | 'building_window'
  | 'training'
  | 'evaluating'
  | 'done'
  | 'failed'
  | null

export type NeuralTrainingGateSummary = {
  baseline_ic: number
  best_latent_ic: number
  n_latents_beating_baseline: number
  passed: boolean
  evaluation_run_id: string
}

export type NeuralTrainingRun = {
  job_id: string
  status: NeuralTrainingJobStatus
  progress: NeuralTrainingProgress
  model_hash?: string | null
  val_metrics?: NeuralValMetrics | null
  gate?: NeuralTrainingGateSummary | null
  gate_error?: string | null
  error?: string | null
}
