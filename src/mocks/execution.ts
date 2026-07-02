import type {
  AuditEvent,
  Decision,
  DeploymentChart,
  DeploymentDetail,
  DeploymentSummary,
  ExecutionHealth,
  ExecutionOrder,
  Fill,
  KillSwitchState,
  LedgerEntry,
  PaperAccount,
  Position,
  RiskEvent,
} from '@/types/execution'

export type MockExecutionScenario =
  | 'normal'
  | 'empty'
  | 'worker_offline'
  | 'stale'
  | 'unknown_orders'
  | 'rejected_action'

let scenario: MockExecutionScenario = 'normal'

const now = () => new Date().toISOString()

const accountId = '11111111-1111-1111-1111-111111111111'
const deploymentId = '22222222-2222-2222-2222-222222222222'
const backtestRunId = '33333333-3333-3333-3333-333333333333'

let killSwitch: KillSwitchState = {
  enabled: false,
  reason: null,
  updated_by: null,
  updated_at: null,
}

const mockAccount: PaperAccount = {
  id: accountId,
  name: 'Paper Desk',
  currency: 'BRL',
  initial_balance: '100000.00',
  cash_balance: '98540.50',
  sizing_config: { type: 'fixed_quantity', quantity: 1 },
  risk_config: { max_daily_loss: '5000', max_notional: '1000000' },
  created_at: '2026-06-01T12:00:00.000Z',
  updated_at: now(),
}

const mockDeploymentSummary: DeploymentSummary = {
  id: deploymentId,
  paper_account_id: accountId,
  name: 'WIN H1 MACrossover',
  broker_mode: 'paper',
  lifecycle: 'running',
  strategy_name: 'MACrossover',
  strategy_version: 1,
  config_hash: 'abc123def456',
  symbol: 'WIN$',
  timeframe: 'H1',
  live_activation_enabled: false,
  pending_action: null,
  pending_action_requested_at: null,
  last_bar_close_time: '2026-06-30T15:00:00.000Z',
  started_at: '2026-06-30T10:00:00.000Z',
  stopped_at: null,
  created_at: '2026-06-29T08:00:00.000Z',
  updated_at: now(),
}

const mockOpenPosition: Position = {
  id: '44444444-4444-4444-4444-444444444444',
  deployment_id: deploymentId,
  side: 'long',
  quantity: '2.00',
  average_entry_price: '132450.00',
  is_open: true,
  opened_at: '2026-06-30T14:00:00.000Z',
  closed_at: null,
  updated_at: now(),
}

const mockLatestDecision: Decision = {
  id: '55555555-5555-5555-5555-555555555555',
  deployment_id: deploymentId,
  bar_close_time: '2026-06-30T15:00:00.000Z',
  strategy_name: 'MACrossover',
  strategy_version: 1,
  config_hash: 'abc123def456',
  symbol: 'WIN$',
  timeframe: 'H1',
  signal_action: 'hold',
  outcome: 'no_trade',
  requested_quantity: null,
  reason: 'fast below slow',
  created_at: now(),
}

let deploymentLifecycle = mockDeploymentSummary.lifecycle
let pendingAction: string | null = null
let unknownOrderCount = 0

const mockAccounts = new Map<string, PaperAccount>([[accountId, mockAccount]])
const mockDeployments = new Map<string, DeploymentDetail>()

function buildDeploymentDetail(): DeploymentDetail {
  const workerLease =
    scenario === 'worker_offline'
      ? null
      : {
          worker_id: 'worker-mock-1',
          acquired_at: '2026-06-30T09:00:00.000Z',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          heartbeat_at: scenario === 'stale' ? new Date(Date.now() - 120_000).toISOString() : now(),
          is_active: scenario !== 'stale',
        }

  return {
    ...mockDeploymentSummary,
    lifecycle: deploymentLifecycle,
    pending_action: pendingAction,
    compiled_config: {
      strategy: 'MACrossover',
      strategy_params: { fast_period: 5, slow_period: 20 },
      symbol: 'WIN$',
      timeframe: 'H1',
    },
    sizing_config: { type: 'fixed_quantity', quantity: 1 },
    risk_config: { max_daily_loss: '5000', max_notional: '1000000' },
    open_position: scenario === 'empty' ? null : mockOpenPosition,
    worker_lease: workerLease,
    latest_decision: mockLatestDecision,
    unknown_order_count: scenario === 'unknown_orders' ? 2 : unknownOrderCount,
  }
}

function seedDeployments() {
  if (scenario === 'empty') {
    mockDeployments.clear()
    return
  }
  mockDeployments.set(deploymentId, buildDeploymentDetail())
}

seedDeployments()

export function setMockExecutionScenario(next: MockExecutionScenario) {
  scenario = next
  deploymentLifecycle = next === 'empty' ? 'draft' : 'running'
  pendingAction = null
  unknownOrderCount = next === 'unknown_orders' ? 2 : 0
  seedDeployments()
}

export function resetMockExecutionState() {
  scenario = 'normal'
  killSwitch = { enabled: false, reason: null, updated_by: null, updated_at: null }
  deploymentLifecycle = 'running'
  pendingAction = null
  unknownOrderCount = 0
  mockAccounts.clear()
  mockAccounts.set(accountId, { ...mockAccount, updated_at: now() })
  seedDeployments()
}

export function getMockExecutionHealth(): ExecutionHealth {
  const workerStatus =
    scenario === 'worker_offline' ? 'offline' : scenario === 'stale' ? 'stale' : 'healthy'
  const deployments =
    scenario === 'empty'
      ? []
      : [
          {
            deployment_id: deploymentId,
            lifecycle: deploymentLifecycle,
            worker_lease: buildDeploymentDetail().worker_lease,
            last_bar_close_time: mockDeploymentSummary.last_bar_close_time,
            latest_decision: mockLatestDecision,
            unknown_order_count: scenario === 'unknown_orders' ? 2 : unknownOrderCount,
            pending_action: pendingAction,
          },
        ]

  return {
    api_status: 'ok',
    worker_status: workerStatus,
    market_data_status: scenario === 'stale' ? 'stale' : 'online',
    kill_switch_enabled: killSwitch.enabled,
    live_capability_locked: true,
    unknown_order_count: scenario === 'unknown_orders' ? 2 : unknownOrderCount,
    deployments,
    checked_at: now(),
  }
}

export function getMockKillSwitch(): KillSwitchState {
  return { ...killSwitch }
}

export function listMockPaperAccounts(limit: number, offset: number) {
  const items = Array.from(mockAccounts.values())
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  }
}

export function createMockPaperAccount(body: {
  name: string
  initial_balance: string
  currency?: string
  sizing_config?: Record<string, unknown>
  risk_config?: Record<string, unknown>
}): PaperAccount {
  const id = crypto.randomUUID()
  const account: PaperAccount = {
    id,
    name: body.name,
    currency: body.currency ?? 'BRL',
    initial_balance: body.initial_balance,
    cash_balance: body.initial_balance,
    sizing_config: body.sizing_config ?? {},
    risk_config: body.risk_config ?? {},
    created_at: now(),
    updated_at: now(),
  }
  mockAccounts.set(id, account)
  return account
}

function toDeploymentSummary(d: DeploymentDetail): DeploymentSummary {
  return {
    id: d.id,
    paper_account_id: d.paper_account_id,
    name: d.name,
    broker_mode: d.broker_mode,
    lifecycle: d.lifecycle,
    strategy_name: d.strategy_name,
    strategy_version: d.strategy_version,
    config_hash: d.config_hash,
    symbol: d.symbol,
    timeframe: d.timeframe,
    live_activation_enabled: d.live_activation_enabled,
    pending_action: d.pending_action,
    pending_action_requested_at: d.pending_action_requested_at,
    last_bar_close_time: d.last_bar_close_time,
    started_at: d.started_at,
    stopped_at: d.stopped_at,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }
}

export function listMockDeployments(paperAccountId: string | null, limit: number, offset: number) {
  let items = Array.from(mockDeployments.values()).map(toDeploymentSummary)
  if (paperAccountId) {
    items = items.filter((d) => d.paper_account_id === paperAccountId)
  }
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  }
}

export function getMockDeployment(id: string): DeploymentDetail | undefined {
  const existing = mockDeployments.get(id)
  if (!existing) return undefined
  const refreshed = buildDeploymentDetail()
  mockDeployments.set(id, refreshed)
  return refreshed
}

export function getMockDeploymentChart(id: string, bars: number): DeploymentChart | undefined {
  const detail = mockDeployments.get(id)
  if (!detail) return undefined

  const count = Math.min(Math.max(bars, 1), 60)
  const tfMs = 60 * 60_000 // H1
  const lastOpen = new Date('2026-06-30T14:00:00.000Z').getTime()
  const chartBars = Array.from({ length: count }, (_, i) => {
    const idx = count - 1 - i
    const openMs = lastOpen - idx * tfMs
    const base = 132000 + Math.sin(i / 4) * 400
    const open = base
    const close = base + Math.cos(i / 3) * 120
    const high = Math.max(open, close) + 60
    const low = Math.min(open, close) - 60
    return {
      timestamp: new Date(openMs).toISOString(),
      open,
      high,
      low,
      close,
      volume: 1000 + (i % 7) * 50,
    }
  })

  const warmup = 5
  const maShort = chartBars.map((_, i) =>
    i < warmup
      ? null
      : chartBars.slice(i - warmup, i + 1).reduce((s, b) => s + b.close, 0) / (warmup + 1),
  )
  const oscillator = chartBars.map((_, i) => (i < warmup ? null : Math.sin(i / 5) * 100))

  return {
    symbol: detail.symbol,
    timeframe: detail.timeframe,
    window_bound_bars: 20,
    last_bar_close_time: new Date(lastOpen + tfMs).toISOString(),
    next_bar_close_time: new Date(lastOpen + 2 * tfMs).toISOString(),
    bars: chartBars,
    indicators: [
      { key: 'ma_short', label: 'MA(5)', pane: 'price', color: '#c9a227', values: maShort },
      { key: 'osc', label: 'Momentum', pane: 'oscillator', color: '#a78bfa', values: oscillator },
    ],
  }
}

export function createMockDeployment(body: {
  paper_account_id: string
  name: string
  source_backtest_run_id?: string
  identity?: Record<string, unknown>
}): DeploymentDetail {
  const id = crypto.randomUUID()
  const detail: DeploymentDetail = {
    ...buildDeploymentDetail(),
    id,
    paper_account_id: body.paper_account_id,
    name: body.name,
    lifecycle: 'draft',
    strategy_name: body.source_backtest_run_id ? 'MACrossover' : 'CustomStrategy',
    symbol: 'WIN$',
    timeframe: 'H1',
    open_position: null,
    pending_action: null,
  }
  mockDeployments.set(id, detail)
  return detail
}

export function applyMockDeploymentAction(
  id: string,
  action: string,
  confirm: boolean,
): { accepted: boolean; lifecycle: string; pending_action: string | null; message: string } {
  if (action === 'flatten' && !confirm) {
    return {
      accepted: false,
      lifecycle: deploymentLifecycle,
      pending_action: pendingAction,
      message: 'flatten requires confirm=true',
    }
  }
  if (scenario === 'rejected_action') {
    return {
      accepted: false,
      lifecycle: deploymentLifecycle,
      pending_action: pendingAction,
      message: 'worker unavailable; command was not accepted',
    }
  }

  if (action === 'start') {
    deploymentLifecycle = 'running'
    pendingAction = null
  } else if (action === 'pause') {
    deploymentLifecycle = 'paused'
    pendingAction = null
  } else if (action === 'stop') {
    deploymentLifecycle = 'stopped'
    pendingAction = null
  } else if (action === 'flatten') {
    pendingAction = 'flatten'
  }

  const detail = mockDeployments.get(id)
  if (detail) {
    mockDeployments.set(id, {
      ...buildDeploymentDetail(),
      id: detail.id,
      name: detail.name,
      paper_account_id: detail.paper_account_id,
    })
  }

  return {
    accepted: true,
    lifecycle: deploymentLifecycle,
    pending_action: pendingAction,
    message:
      action === 'flatten'
        ? 'flatten queued for worker'
        : `${action} acknowledged; open positions remain until flattened`,
  }
}

export function updateMockKillSwitch(body: {
  enabled: boolean
  confirm?: boolean
  reason?: string
  updated_by?: string
}) {
  if (body.enabled && !body.confirm) {
    return {
      accepted: false,
      kill_switch: getMockKillSwitch(),
      audit_event_id: crypto.randomUUID(),
    }
  }
  killSwitch = {
    enabled: body.enabled,
    reason: body.reason ?? null,
    updated_by: body.updated_by ?? 'operator',
    updated_at: now(),
  }
  return {
    accepted: true,
    kill_switch: getMockKillSwitch(),
    audit_event_id: crypto.randomUUID(),
  }
}

function paginate<T>(items: T[], limit: number, offset: number) {
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  }
}

const mockDecisions: Decision[] = Array.from({ length: 40 }, (_, i) => ({
  ...mockLatestDecision,
  id: `dec-${i}`,
  signal_action: i % 3 === 0 ? 'buy' : 'hold',
  outcome: i % 3 === 0 ? 'submitted' : 'no_trade',
  created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
}))

const mockOrders: ExecutionOrder[] = Array.from({ length: 30 }, (_, i) => ({
  id: `ord-${i}`,
  deployment_id: deploymentId,
  decision_id: `dec-${i}`,
  broker_mode: 'paper',
  side: i % 2 === 0 ? 'buy' : 'sell',
  order_type: 'market',
  quantity: '1.00',
  status: i === 0 && scenario === 'unknown_orders' ? 'unknown' : 'filled',
  reconciliation_state: i === 0 && scenario === 'unknown_orders' ? 'unknown' : 'matched',
  rejection_reason: null,
  intent_committed_at: now(),
  submitted_at: now(),
  completed_at: now(),
  created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
}))

const mockFills: Fill[] = Array.from({ length: 25 }, (_, i) => ({
  id: `fill-${i}`,
  deployment_id: deploymentId,
  order_id: `ord-${i}`,
  broker_mode: 'paper',
  external_fill_id: `ext-${i}`,
  side: 'buy',
  quantity: '1.00',
  price: '132000.00',
  fee: '2.50',
  slippage: '0.00',
  filled_at: new Date(Date.now() - i * 3_600_000).toISOString(),
  created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
}))

const mockLedger: LedgerEntry[] = Array.from({ length: 35 }, (_, i) => ({
  id: `led-${i}`,
  paper_account_id: accountId,
  deployment_id: deploymentId,
  fill_id: `fill-${i}`,
  entry_type: i % 2 === 0 ? 'realized_pnl' : 'fee',
  amount: i % 2 === 0 ? '120.50' : '-2.50',
  balance_after: `${98540 - i * 10}.50`,
  description: i % 2 === 0 ? 'Round-trip P&L' : 'Commission',
  created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
}))

const mockRiskEvents: RiskEvent[] = [
  {
    id: 'risk-1',
    deployment_id: deploymentId,
    decision_id: null,
    order_id: null,
    rejection_code: 'MAX_NOTIONAL',
    message: 'Requested notional exceeds account limit',
    context: { requested: '1500000' },
    created_at: now(),
  },
]

const mockAuditEvents: AuditEvent[] = [
  {
    id: 'audit-1',
    event_type: 'deployment.start',
    actor: 'operator',
    deployment_id: deploymentId,
    message: 'Deployment started',
    payload: {},
    created_at: now(),
  },
]

export function listMockDecisions(limit: number, offset: number) {
  return paginate(mockDecisions, limit, offset)
}

export function listMockOrders(limit: number, offset: number) {
  return paginate(mockOrders, limit, offset)
}

export function listMockFills(limit: number, offset: number) {
  return paginate(mockFills, limit, offset)
}

export function listMockPositions(limit: number, offset: number) {
  const items = scenario === 'empty' ? [] : [mockOpenPosition]
  return paginate(items, limit, offset)
}

export function listMockLedger(limit: number, offset: number) {
  return paginate(mockLedger, limit, offset)
}

export function listMockRiskEvents(limit: number, offset: number) {
  return paginate(mockRiskEvents, limit, offset)
}

export function listMockAuditEvents(limit: number, offset: number) {
  return paginate(mockAuditEvents, limit, offset)
}

export const mockExecutionBacktestRunId = backtestRunId
