// TS mirrors of q_backend/src/q_backend/optimization/models.py and the
// async job payloads exposed by the /api/v1/optimize endpoints.

import type { EntryInstance, EntryManagerConfig, TransactionCostConfig } from '@/types/backtesting'

export type IntParam = { type: 'int'; low: number; high: number; step?: number }
export type FloatParam = { type: 'float'; low: number; high: number; step?: number | null }
export type LogFloatParam = { type: 'log-float'; low: number; high: number }
export type CategoricalParam = { type: 'categorical'; choices: (string | number)[] }

export type SearchParam = IntParam | FloatParam | LogFloatParam | CategoricalParam

export type SearchSpaceConfig = {
  strategy_params: Record<string, SearchParam>
  risk_params: Record<string, SearchParam>
  manager_params?: Record<string, SearchParam>
}

// Matches ObjectiveMode in models.py:10-15
export type ObjectiveMode =
  | 'maximize_net_profit'
  | 'maximize_sharpe'
  | 'minimize_drawdown'
  | 'maximize_return_drawdown'
  | 'multi_objective_return_drawdown'

export type Sampler = 'tpe' | 'random' | 'nsgaii'

export type StudyConfig = {
  name: string
  n_trials: number
  seed?: number
  sampler?: Sampler | null
  pruner?: 'none' | 'median' | 'hyperband'
  continue_on_trial_error?: boolean
  /** Omit or null => auto (one worker per CPU, capped by n_trials). */
  max_workers?: number | null
}

export type ObjectiveConfig = { mode: ObjectiveMode }

export type OptimizationBacktestConfig = {
  symbol: string
  timeframe?: string
  start: string
  end: string
  initial_capital: number
  point_value: number
  strategy: string
  entries?: EntryInstance[]
  entry_manager?: EntryManagerConfig
  exit_params?: Record<string, unknown>
  costs?: TransactionCostConfig
  day_trade?: boolean
  day_trade_start_time?: string
  day_trade_end_time?: string
  day_trade_close_time?: string
  engine?: 'candle' | 'tick'
  /** Tick-only: chart/display bar size. */
  display_timeframe?: string
  /** Tick-only: tick source filter. */
  tick_flags?: 'all' | 'trade'
}

export type OptimizationConfig = {
  study: StudyConfig
  objective: ObjectiveConfig
  backtest: OptimizationBacktestConfig
  search_space: SearchSpaceConfig
}

export type JobStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled'

export type OptimizationStartResponse = {
  study_id: string
  status: JobStatus
}

export type OptimizationStatus = {
  study_id: string
  status: JobStatus
  completed_trials: number
  n_trials: number
  best_value: number | null
  best_params: Record<string, unknown>
  error: string | null
  /** Resolved parallel process count for candle studies (omit or 1 => sequential UI). */
  workers?: number
  /** Present when the backend can resolve the study's original backtest window. */
  backtest_config?: OptimizationBacktestConfig
  /** Full optimization config for rehydrating the optimizer form. */
  optimization_config?: OptimizationConfig
  best_trial?: OptimizationTrial | null
  trials?: OptimizationTrial[]
}

export type OptimizationTrial = {
  number: number
  params: Record<string, unknown>
  values: number[] | null
  state: string
  user_attrs: {
    status?: string
    error?: string
    metrics?: Record<string, number>
    strategy_params?: Record<string, unknown>
    risk_params?: Record<string, unknown>
    [key: string]: unknown
  }
}

export type OptimizationResults = {
  study_id: string
  objective_mode: ObjectiveMode
  is_multi_objective: boolean
  best_params: Record<string, unknown>
  best_trial: OptimizationTrial | null
  trials: OptimizationTrial[]
  pareto_trials: OptimizationTrial[]
  failures: { trial_number: number; error: string }[]
}

export type OptimizationStudySummary = {
  study_id: string
  name: string
  status: JobStatus
  best_value: number | null
  n_trials: number
  completed_trials: number
  created_at: string
}

export type OptimizationStudyListResponse = {
  items: OptimizationStudySummary[]
  total: number
  limit: number
  offset: number
}

export type ParamImportanceEntry = { param: string; importance: number }

export type ParallelCoordinateRow = {
  number: number
  params: Record<string, number | string>
  values: number[]
}

export type ParallelCoordinatePayload = {
  params: string[]
  objectives: string[]
  rows: ParallelCoordinateRow[]
  rows_capped?: boolean
}

export type ParetoPoint = {
  number: number
  values: number[]
  params: Record<string, number | string>
}

export type ParetoFrontPayload = {
  is_multi_objective: boolean
  objectives: string[]
  points: ParetoPoint[]
}

export type OptimizationAnalytics = {
  study_id: string
  status: JobStatus
  is_multi_objective: boolean
  n_complete_trials: number
  objective_labels: string[]
  param_importances: Record<string, ParamImportanceEntry[]> | null
  parallel_coordinate: ParallelCoordinatePayload
  pareto_front: ParetoFrontPayload
}
