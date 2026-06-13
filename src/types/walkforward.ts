import type { OptimizationBacktestConfig, OptimizationConfig } from '@/types/optimization'

export type WalkForwardMode = 'rolling' | 'anchored'

export type WalkForwardConfig = {
  train_days: number
  test_days: number
  mode: WalkForwardMode
  min_windows: number
  /** Worker processes for parallel window execution. Omit/null = auto (one per CPU). */
  max_workers?: number | null
}

export type WalkForwardRequest = {
  optimization: OptimizationConfig
  walkforward: WalkForwardConfig
}

export type WalkForwardJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type WalkForwardPhase = 'optimizing' | 'testing'

export type WalkForwardStartResponse = {
  run_id: string
  status: WalkForwardJobStatus
}

export type WalkForwardStatus = {
  run_id: string
  status: WalkForwardJobStatus
  current_window: number
  total_windows: number
  /** Worker processes running windows in parallel. >1 means parallel execution. */
  workers?: number
  phase: WalkForwardPhase | null
  windows_completed: number
  error: string | null
  optimization_config?: OptimizationConfig
  walkforward_config?: WalkForwardConfig
  backtest_config?: OptimizationBacktestConfig
}

export type WalkForwardWindowStatus = 'completed' | 'no_result'

export type WalkForwardWindowResult = {
  index: number
  train_start: string
  train_end: string
  test_start: string
  test_end: string
  status: WalkForwardWindowStatus
  best_params: Record<string, unknown>
  is_metrics: Record<string, number> | null
  oos_metrics: Record<string, number> | null
}

export type WalkForwardEquityPoint = {
  time: string
  equity: number
}

export type WalkForwardResults = {
  run_id: string
  status: WalkForwardJobStatus
  windows: WalkForwardWindowResult[]
  oos_metrics: Record<string, number>
  efficiency: number | null
  equity_curve: WalkForwardEquityPoint[]
  optimization_config?: OptimizationConfig
  walkforward_config?: WalkForwardConfig
  lake_paths?: Record<string, string>
}

export type WalkForwardRunSummary = {
  run_id: string
  name: string
  status: WalkForwardJobStatus
  symbol: string | null
  strategy: string | null
  efficiency: number | null
  window_count: number
  created_at: string
}

export type WalkForwardRunListResponse = {
  items: WalkForwardRunSummary[]
  total: number
  limit: number
  offset: number
}

export function isWalkForwardTerminalStatus(status: WalkForwardJobStatus | undefined): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

export function shouldFetchWalkForwardResults(status: WalkForwardJobStatus | undefined): boolean {
  return status === 'completed' || status === 'cancelled'
}
