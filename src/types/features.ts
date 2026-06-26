export type FeatureStatus = 'experimental' | 'candidate' | 'production'

export type ResearchTab = 'store' | 'scoring' | 'lab'

export type FeatureListItem = {
  name: string
  category: string
  latest_version: number
  status: FeatureStatus
  usage_count: number
  score: number | null
  leakage_status?: string | null
}

export type FeatureListResponse = {
  features: FeatureListItem[]
}

export type FeatureVersionDetail = {
  version: number
  status: FeatureStatus
  node_kind: string
  param_keys: string[]
  default_params: Record<string, unknown>
  forward_window: number
  leakage_status: string
  provenance: Record<string, unknown>
}

export type FeaturePassportEvaluationEntry = {
  run_id: string
  target: string
  rank_ic: number | null
  global_score: number | null
  evaluated_at: string
  symbol?: string | null
  timeframe?: string | null
}

export type FeaturePassport = {
  name: string
  category: string
  description: string | null
  usage_count: number
  versions: FeatureVersionDetail[]
  evaluation_history: FeaturePassportEvaluationEntry[]
  score?: number | null
}

export type FeatureLeaderboardItem = {
  feature_name: string
  global_score: number
}

export type FeatureLeaderboardResponse = {
  features: FeatureLeaderboardItem[]
}

export type FeatureScoreRow = {
  feature_id: string
  feature_name: string
  ic: number | null
  rank_ic: number | null
  mutual_info: number | null
  stability: number | null
  global_score: number | null
  cluster_id: number | null
  is_representative: boolean
  leakage_status: string
  regime_ics: Record<string, number | null>
  window_rank_ics?: (number | null)[]
}

export type FeatureEvalCluster = {
  cluster_id: number
  feature_ids: string[]
  representative: string
}

export type FeatureEvalHeatmapRow = {
  feature_id: string
  feature_name: string
  ic: number | null
  rank_ic: number | null
  mutual_info: number | null
  stability: number | null
}

export type FeatureEvalHeatmap = {
  metrics: string[]
  rows: FeatureEvalHeatmapRow[]
}

export type FeatureEvalResultSummary = {
  recommended_feature_ids?: string[]
  cluster_count?: number
  top_global_score?: number | null
  matrix_id?: string
}

export type FeatureEvalRun = {
  run_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  symbol: string
  timeframe: string
  target_name: string
  target_horizon: number
  feature_count: number
  matrix_id?: string
  result_summary?: FeatureEvalResultSummary | null
  error_message?: string | null
  leaderboard: FeatureScoreRow[]
  clusters: FeatureEvalCluster[]
  heatmap: FeatureEvalHeatmap
}

export type FeatureEvalStartResponse = {
  run_id: string
  status: string
}

export type EvalRunTargetRequest = {
  name: string
  horizon: number
}

export type EvalRunFeatureRequest = {
  name: string
  version?: number
  params?: Record<string, unknown>
}

export type EvalRunRequest = {
  symbol: string
  timeframe: string
  start: string
  end: string
  target: EvalRunTargetRequest
  features: EvalRunFeatureRequest[]
}

export type FeatureStatusUpdateRequest = {
  status: FeatureStatus
}
