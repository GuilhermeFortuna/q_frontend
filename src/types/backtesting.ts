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

export interface BacktestResponse {
  metrics: BacktestMetrics
  trades: Trade[]
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
