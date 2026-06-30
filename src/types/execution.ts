import type { PositionSizingConfig } from '@/types/backtesting'

export type ExecutionApiStatus = 'ok' | 'degraded' | 'unavailable'
export type ExecutionWorkerStatus = 'healthy' | 'stale' | 'offline'
export type ExecutionMarketDataStatus = 'online' | 'offline' | 'stale'

export type DeploymentLifecycle = 'draft' | 'running' | 'paused' | 'stopped'

export type PaginatedMeta = {
  total: number
  limit: number
  offset: number
}

export type PaperAccountCreateRequest = {
  name: string
  initial_balance: string
  currency?: string
  sizing_config?: Record<string, unknown>
  risk_config?: Record<string, unknown>
}

export type PaperAccount = {
  id: string
  name: string
  currency: string
  initial_balance: string
  cash_balance: string
  sizing_config: Record<string, unknown>
  risk_config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type PaperAccountListResponse = PaginatedMeta & {
  items: PaperAccount[]
}

export type DeploymentIdentityInput = {
  strategy_name: string
  strategy_version: number
  compiled_config: Record<string, unknown>
  config_hash: string
  symbol: string
  timeframe: string
  sizing_config: Record<string, unknown>
  risk_config?: Record<string, unknown>
}

export type DeploymentCreateRequest = {
  paper_account_id: string
  name: string
  broker_mode?: 'paper'
  live_activation_enabled?: boolean
  source_backtest_run_id?: string
  identity?: DeploymentIdentityInput
}

export type DeploymentSummary = {
  id: string
  paper_account_id: string
  name: string
  broker_mode: string
  lifecycle: DeploymentLifecycle | string
  strategy_name: string
  strategy_version: number
  config_hash: string
  symbol: string
  timeframe: string
  live_activation_enabled: boolean
  pending_action: string | null
  pending_action_requested_at: string | null
  last_bar_close_time: string | null
  started_at: string | null
  stopped_at: string | null
  created_at: string
  updated_at: string
}

export type WorkerLease = {
  worker_id: string
  acquired_at: string
  expires_at: string
  heartbeat_at: string
  is_active: boolean
}

export type Decision = {
  id: string
  deployment_id: string
  bar_close_time: string
  strategy_name: string
  strategy_version: number
  config_hash: string
  symbol: string
  timeframe: string
  signal_action: string
  outcome: string
  requested_quantity: string | null
  reason: string | null
  created_at: string
}

export type ExecutionOrder = {
  id: string
  deployment_id: string
  decision_id: string | null
  broker_mode: string
  side: string
  order_type: string
  quantity: string
  status: string
  reconciliation_state: string
  rejection_reason: string | null
  intent_committed_at: string | null
  submitted_at: string | null
  completed_at: string | null
  created_at: string
}

export type Fill = {
  id: string
  deployment_id: string
  order_id: string
  broker_mode: string
  external_fill_id: string
  side: string
  quantity: string
  price: string
  fee: string
  slippage: string
  filled_at: string
  created_at: string
}

export type Position = {
  id: string
  deployment_id: string
  side: string
  quantity: string
  average_entry_price: string | null
  is_open: boolean
  opened_at: string | null
  closed_at: string | null
  updated_at: string
}

export type LedgerEntry = {
  id: string
  paper_account_id: string
  deployment_id: string
  fill_id: string | null
  entry_type: string
  amount: string
  balance_after: string
  description: string | null
  created_at: string
}

export type RiskEvent = {
  id: string
  deployment_id: string
  decision_id: string | null
  order_id: string | null
  rejection_code: string
  message: string
  context: Record<string, unknown>
  created_at: string
}

export type AuditEvent = {
  id: string
  event_type: string
  actor: string | null
  deployment_id: string | null
  message: string
  payload: Record<string, unknown>
  created_at: string
}

export type DeploymentDetail = DeploymentSummary & {
  compiled_config: Record<string, unknown>
  sizing_config: Record<string, unknown>
  risk_config: Record<string, unknown>
  open_position: Position | null
  worker_lease: WorkerLease | null
  latest_decision: Decision | null
  unknown_order_count: number
}

export type DeploymentListResponse = PaginatedMeta & {
  items: DeploymentSummary[]
}

export type DeploymentActionRequest = {
  action: 'start' | 'pause' | 'stop' | 'flatten'
  confirm?: boolean
  actor?: string
}

export type DeploymentActionResponse = {
  accepted: boolean
  deployment_id: string
  lifecycle: string
  pending_action: string | null
  message: string
}

export type DecisionListResponse = PaginatedMeta & { items: Decision[] }
export type OrderListResponse = PaginatedMeta & { items: ExecutionOrder[] }
export type FillListResponse = PaginatedMeta & { items: Fill[] }
export type PositionListResponse = PaginatedMeta & { items: Position[] }
export type LedgerListResponse = PaginatedMeta & { items: LedgerEntry[] }
export type RiskEventListResponse = PaginatedMeta & { items: RiskEvent[] }
export type AuditEventListResponse = PaginatedMeta & { items: AuditEvent[] }

export type DeploymentHealth = {
  deployment_id: string
  lifecycle: string
  worker_lease: WorkerLease | null
  last_bar_close_time: string | null
  latest_decision: Decision | null
  unknown_order_count: number
  pending_action: string | null
}

export type ExecutionHealth = {
  api_status: ExecutionApiStatus
  worker_status: ExecutionWorkerStatus
  market_data_status: ExecutionMarketDataStatus
  kill_switch_enabled: boolean
  live_capability_locked: boolean
  unknown_order_count: number
  deployments: DeploymentHealth[]
  checked_at: string
}

export type KillSwitchState = {
  enabled: boolean
  reason: string | null
  updated_by: string | null
  updated_at: string | null
}

export type KillSwitchUpdateRequest = {
  enabled: boolean
  confirm?: boolean
  reason?: string
  updated_by?: string
}

export type KillSwitchUpdateResponse = {
  accepted: boolean
  kill_switch: KillSwitchState
  audit_event_id: string
}

export type ExecutionHistoryKind =
  | 'decisions'
  | 'orders'
  | 'fills'
  | 'ledger'
  | 'risk-events'
  | 'audit-events'

export type DeploymentSizingDraft = {
  sizing: PositionSizingConfig
  risk: Record<string, string>
}
