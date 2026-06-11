import type { OhlcvBar } from '@/types/api'

export type FixedQuantityPositionSizing = {
  type: 'fixed_quantity'
  quantity: number
}

export type FixedSafetyMarginPositionSizing = {
  type: 'fixed_safety_margin'
  safety_margin_per_contract: number
  min_contracts: number
  max_contracts: number | null
}

export type PositionSizingConfig = FixedQuantityPositionSizing | FixedSafetyMarginPositionSizing

export interface BacktestRequest {
  symbol: string
  timeframe?: string
  start?: string
  end?: string
  initial_capital?: number
  point_value?: number
  strategy?: string
  strategy_params?: Record<string, unknown>
  position_sizing?: PositionSizingConfig
  day_trade?: boolean
  day_trade_start_time?: string
  day_trade_end_time?: string
  day_trade_close_time?: string
  engine?: 'candle' | 'tick'
  /** Tick-only: bar size for chart resampling (e.g. M1). */
  display_timeframe?: string
  /** Tick-only: tick source filter. */
  tick_flags?: 'all' | 'trade'
}

export interface Trade {
  id: string
  order_id: string
  symbol: string
  action: 'BUY' | 'SELL'
  quantity: number
  entry_time: string
  entry_price: number
  exit_time: string | null
  exit_price: number | null
  status: 'OPEN' | 'CLOSED'
  pnl: number | null
  commission: number
  point_value: number
}

export interface BacktestMetrics {
  total_trades: number
  total_pnl: number
  win_rate: number
  winning_trades: number
  losing_trades: number
  max_drawdown_value: number
  max_drawdown_pct: number
  profit_factor: number
  recovery_factor: number
  expectancy: number
  avg_win: number
  avg_loss: number
  win_loss_ratio: number
  max_consecutive_wins: number
  max_consecutive_losses: number
}

export interface ChartIndicatorSeries {
  key: string
  label: string
  pane: 'price' | 'oscillator'
  color?: string
  values: (number | null)[]
}

/** Live run response — always includes full chart payload; run_id is null when persistence is unavailable. */
export interface BacktestResponse {
  metrics: BacktestMetrics
  trades: Trade[]
  bars: OhlcvBar[]
  indicators: ChartIndicatorSeries[]
  run_id?: string | null
}

export type BacktestRunStatus = 'pending' | 'running' | 'completed' | 'failed'

export type BacktestHistorySort = 'created_at_desc' | 'pnl_desc' | 'pnl_asc'

export interface BacktestRunSummary {
  run_id: string
  symbol: string
  strategy: string
  timeframe: string
  status: BacktestRunStatus
  created_at: string
  is_saved: boolean
  /** Null when the run failed or metrics were not stored. */
  summary: BacktestMetrics | null
}

/** Persisted run detail — metrics + config only; no trades/bars/indicators. */
export interface BacktestRunDetail {
  run_id: string
  symbol: string
  strategy: string
  timeframe: string
  status: BacktestRunStatus
  config: BacktestRequest
  /** Null when the run failed or metrics were not stored. */
  result_summary: BacktestMetrics | null
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  is_saved: boolean
}

export interface BulkDeleteResponse {
  deleted: number
  not_found: string[]
}

export interface BacktestRunListResponse {
  items: BacktestRunSummary[]
  total: number
  limit: number
  offset: number
}

export interface EquityPoint {
  timestamp: string
  equity: number
  pnl: number
  drawdown: number
  drawdownPct: number
}

export interface MonthlyStats {
  month: string
  label: string
  pnl: number
  trades: number
  wins: number
  losses: number
  winRate: number
}
