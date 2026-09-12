import axios from 'axios'
import { useMemo, useState, useCallback } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { ExternalLink } from 'lucide-react'

import {
  EXECUTION_PAGE_SIZE,
  useCreateDeployment,
  useCreatePaperAccount,
  useDecisions,
  useDeployment,
  useDeploymentAction,
  useDeployments,
  useExecutionHealth,
  useFills,
  useKillSwitch,
  useLedger,
  useOrders,
  usePaperAccounts,
  useRiskEvents,
  useUpdateKillSwitch,
} from '@/api/queries/execution'
import { useBacktestHistory } from '@/api/queries/backtests'
import { ExecutionLiveChartPanel } from '@/workspaces/execution/ExecutionLiveChartPanel'
import { PowerOffSlide } from '@/components/execution/PowerOffSlide'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LabeledField } from '@/components/ui/LabeledField'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { GlowCard } from '@/components/ui/spotlight-card'
import { StatTile } from '@/components/ui/StatTile'
import { Button } from '@/components/ui/button'
import { chipClass } from '@/components/ui/chipStyles'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type {
  ExecutionHistoryKind,
  Decision,
  ExecutionOrder,
  Fill,
  LedgerEntry,
  RiskEvent,
} from '@/types/execution'

type ExecutionWorkspaceProps = {
  /** When false, all execution polling stops (route visibility guard). */
  pollingEnabled?: boolean
}

type ConfirmKind = 'flatten' | null

const HISTORY_TABS: { value: ExecutionHistoryKind; label: string }[] = [
  { value: 'decisions', label: 'Decisions' },
  { value: 'orders', label: 'Orders' },
  { value: 'fills', label: 'Fills' },
  { value: 'ledger', label: 'Ledger' },
  { value: 'risk-events', label: 'Risk' },
]

function statusToStatTileTone(status: string): 'up' | 'down' | 'warning' | 'neutral' {
  if (status === 'healthy' || status === 'ok' || status === 'online' || status === 'running') {
    return 'up'
  }
  if (status === 'stale' || status === 'degraded' || status === 'paused') {
    return 'warning'
  }
  if (!status) return 'neutral'
  return 'down'
}

function EnvironmentBadges() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold tracking-wider text-emerald-300 uppercase"
        data-testid="execution-paper-badge"
      >
        Paper
      </span>
      <span
        className="border-silver-500/30 bg-carbon-900/80 text-silver-500 rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase"
        title="Live trading is locked by backend policy (WO172)."
        data-testid="execution-live-locked-badge"
      >
        Live locked
      </span>
    </div>
  )
}

function HealthSignals({
  apiStatus,
  workerStatus,
  marketStatus,
  unknownOrders,
}: {
  apiStatus: string
  workerStatus: string
  marketStatus: string
  unknownOrders: number
}) {
  return (
    <Panel
      className="p-4"
      living
      data-testid="execution-health-panel"
      data-workspace-transition-surface="primary"
    >
      <p className="text-silver-400 mb-3 text-xs">
        API reachability is separate from worker heartbeat and market-data freshness.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="API" value={apiStatus} valueTone={statusToStatTileTone(apiStatus)} />
        <StatTile
          label="Worker"
          value={workerStatus}
          valueTone={statusToStatTileTone(workerStatus)}
        />
        <StatTile
          label="Market data"
          value={marketStatus}
          valueTone={statusToStatTileTone(marketStatus)}
        />
        <StatTile
          label="Unknown orders"
          value={String(unknownOrders)}
          valueTone={unknownOrders > 0 ? 'down' : 'neutral'}
          highlight={unknownOrders > 0}
        />
      </div>
      {apiStatus === 'ok' && workerStatus === 'offline' ? (
        <div
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-300"
          data-testid="execution-worker-down-banner"
        >
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-amber-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <span className="font-semibold text-amber-200">Worker Lease offline:</span> Control API
            is up, but no healthy worker lease was detected. Lifecycle commands may queue until a
            worker reconnects.
          </div>
        </div>
      ) : null}
      {unknownOrders > 0 ? (
        <div
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300"
          data-testid="execution-unknown-orders-banner"
        >
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-rose-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <span className="font-semibold text-rose-200">Reconciliation Required:</span>{' '}
            {unknownOrders} order(s) need reconciliation — inspect the Orders tab and worker logs
            before flattening.
          </div>
        </div>
      ) : null}
    </Panel>
  )
}

function PaginatedHistoryTable({
  kind,
  deploymentId,
  accountId,
  offset,
  onOffsetChange,
  pollingEnabled,
}: {
  kind: ExecutionHistoryKind
  deploymentId: string | null
  accountId: string | null
  offset: number
  onOffsetChange: (next: number) => void
  pollingEnabled: boolean
}) {
  const poll = { enabled: pollingEnabled }
  const decisions = useDecisions(kind === 'decisions' ? deploymentId : null, offset, poll)
  const orders = useOrders(kind === 'orders' ? deploymentId : null, offset, poll)
  const fills = useFills(kind === 'fills' ? deploymentId : null, offset, poll)
  const ledger = useLedger(kind === 'ledger' ? accountId : null, offset, poll)
  const risk = useRiskEvents(kind === 'risk-events' ? deploymentId : null, offset, poll)

  const activeQuery =
    kind === 'decisions'
      ? decisions
      : kind === 'orders'
        ? orders
        : kind === 'fills'
          ? fills
          : kind === 'ledger'
            ? ledger
            : risk

  const { data, isLoading, isError } = activeQuery
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageStart = offset + 1
  const pageEnd = Math.min(offset + EXECUTION_PAGE_SIZE, total)

  const renderHeaders = () => {
    switch (kind) {
      case 'decisions':
        return (
          <>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Time</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Action</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Outcome</th>
            <th className="text-silver-400 px-4 py-2.5 text-right font-semibold">Requested Qty</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Reason</th>
          </>
        )
      case 'orders':
        return (
          <>
            <th className="text-silver-400 px-4 py-2.5 font-mono font-semibold">Time</th>
            <th className="text-silver-400 px-4 py-2.5 font-mono font-semibold">Order ID</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Side</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Type</th>
            <th className="text-silver-400 px-4 py-2.5 text-right font-semibold">Qty</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Status</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Reconciliation</th>
          </>
        )
      case 'fills':
        return (
          <>
            <th className="text-silver-400 px-4 py-2.5 font-mono font-semibold">Time</th>
            <th className="text-silver-400 px-4 py-2.5 font-mono font-semibold">Fill ID</th>
            <th className="text-silver-400 px-4 py-2.5 font-mono font-semibold">Order ID</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Side</th>
            <th className="text-silver-400 px-4 py-2.5 text-right font-semibold">Price</th>
            <th className="text-silver-400 px-4 py-2.5 text-right font-semibold">Qty</th>
            <th className="text-silver-400 px-4 py-2.5 text-right font-semibold">Fee</th>
            <th className="text-silver-400 px-4 py-2.5 text-right font-semibold">Slippage</th>
          </>
        )
      case 'ledger':
        return (
          <>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Time</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Type</th>
            <th className="text-silver-400 px-4 py-2.5 text-right font-semibold">Amount</th>
            <th className="text-silver-400 px-4 py-2.5 text-right font-semibold">Balance After</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Description</th>
          </>
        )
      case 'risk-events':
        return (
          <>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Time</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Rejection Code</th>
            <th className="text-silver-400 px-4 py-2.5 font-semibold">Message</th>
            <th className="text-silver-400 px-4 py-2.5 text-right font-mono font-semibold">
              Context
            </th>
          </>
        )
      default:
        return <th className="text-silver-400 px-4 py-2.5 font-semibold">Raw Data</th>
    }
  }

  const renderRow = (row: unknown) => {
    switch (kind) {
      case 'decisions': {
        const item = row as Decision
        return (
          <>
            <td className="text-silver-300 px-4 py-2 font-mono whitespace-nowrap">
              {formatDisplayDateTime(item.created_at || item.bar_close_time)}
            </td>
            <td className="px-4 py-2 whitespace-nowrap">
              <span
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                  item.signal_action === 'buy'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    : item.signal_action === 'sell'
                      ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                      : item.signal_action === 'hold'
                        ? 'bg-silver-500/10 text-silver-300 border-silver-500/25'
                        : 'border-amber-500/25 bg-amber-500/10 text-amber-300',
                )}
              >
                {item.signal_action}
              </span>
            </td>
            <td className="px-4 py-2 whitespace-nowrap">
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  item.outcome === 'executed' || item.outcome === 'submitted'
                    ? 'border border-emerald-500/15 bg-emerald-500/5 text-emerald-400'
                    : item.outcome === 'no_trade'
                      ? 'bg-carbon-800 text-silver-400 border-carbon-700 border'
                      : 'border border-rose-500/15 bg-rose-500/5 text-rose-400',
                )}
              >
                {item.outcome}
              </span>
            </td>
            <td className="text-silver-300 px-4 py-2 text-right font-mono font-medium">
              {item.requested_quantity ?? '—'}
            </td>
            <td className="text-silver-400 max-w-xs truncate px-4 py-2" title={item.reason ?? ''}>
              {item.reason ?? '—'}
            </td>
          </>
        )
      }
      case 'orders': {
        const item = row as ExecutionOrder
        return (
          <>
            <td className="text-silver-300 px-4 py-2 font-mono whitespace-nowrap">
              {formatDisplayDateTime(item.created_at)}
            </td>
            <td className="text-silver-400 px-4 py-2 font-mono" title={item.id}>
              {item.id.slice(0, 8)}…
            </td>
            <td className="px-4 py-2 whitespace-nowrap">
              <span
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                  item.side === 'buy'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/25 bg-rose-500/10 text-rose-300',
                )}
              >
                {item.side}
              </span>
            </td>
            <td className="text-silver-300 px-4 py-2 text-[10px] font-medium tracking-wide uppercase">
              {item.order_type}
            </td>
            <td className="text-silver-300 px-4 py-2 text-right font-mono font-medium">
              {item.quantity}
            </td>
            <td className="px-4 py-2 whitespace-nowrap">
              <span
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                  item.status === 'filled'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : item.status === 'pending'
                      ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                      : 'border-rose-500/20 bg-rose-500/10 text-rose-300',
                )}
              >
                {item.status}
              </span>
            </td>
            <td className="text-silver-400 px-4 py-2 font-mono text-[10px]">
              {item.reconciliation_state}
            </td>
          </>
        )
      }
      case 'fills': {
        const item = row as Fill
        return (
          <>
            <td className="text-silver-300 px-4 py-2 font-mono whitespace-nowrap">
              {formatDisplayDateTime(item.filled_at || item.created_at)}
            </td>
            <td className="text-silver-400 px-4 py-2 font-mono" title={item.id}>
              {item.id.slice(0, 8)}…
            </td>
            <td className="text-silver-400 px-4 py-2 font-mono" title={item.order_id}>
              {item.order_id.slice(0, 8)}…
            </td>
            <td className="px-4 py-2 whitespace-nowrap">
              <span
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                  item.side === 'buy'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/25 bg-rose-500/10 text-rose-300',
                )}
              >
                {item.side}
              </span>
            </td>
            <td className="text-silver-100 px-4 py-2 text-right font-mono font-semibold">
              {Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </td>
            <td className="text-silver-300 px-4 py-2 text-right font-mono font-medium">
              {item.quantity}
            </td>
            <td className="text-silver-400 px-4 py-2 text-right font-mono">
              {Number(item.fee).toFixed(2)}
            </td>
            <td className="text-silver-400 px-4 py-2 text-right font-mono">
              {Number(item.slippage).toFixed(2)}
            </td>
          </>
        )
      }
      case 'ledger': {
        const item = row as LedgerEntry
        const amt = Number(item.amount)
        const isPositive = amt >= 0
        return (
          <>
            <td className="text-silver-300 px-4 py-2 font-mono whitespace-nowrap">
              {formatDisplayDateTime(item.created_at)}
            </td>
            <td className="text-silver-300 px-4 py-2 text-[10px] font-medium tracking-wider whitespace-nowrap uppercase">
              {item.entry_type.replace('_', ' ')}
            </td>
            <td
              className={cn(
                'px-4 py-2 text-right font-mono font-semibold whitespace-nowrap',
                isPositive ? 'text-emerald-400' : 'text-rose-400',
              )}
            >
              {isPositive ? '+' : ''}
              {amt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </td>
            <td className="text-silver-100 px-4 py-2 text-right font-mono font-medium">
              {Number(item.balance_after).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </td>
            <td
              className="text-silver-400 max-w-xs truncate px-4 py-2"
              title={item.description ?? ''}
            >
              {item.description ?? '—'}
            </td>
          </>
        )
      }
      case 'risk-events': {
        const item = row as RiskEvent
        return (
          <>
            <td className="text-silver-300 px-4 py-2 font-mono whitespace-nowrap">
              {formatDisplayDateTime(item.created_at)}
            </td>
            <td className="px-4 py-2 whitespace-nowrap">
              <span className="rounded border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-rose-300 uppercase">
                {item.rejection_code}
              </span>
            </td>
            <td className="text-silver-200 px-4 py-2 leading-normal" title={item.message}>
              {item.message}
            </td>
            <td
              className="text-silver-400 max-w-xs truncate px-4 py-2 text-right font-mono text-[10px]"
              title={JSON.stringify(item.context)}
            >
              {JSON.stringify(item.context)}
            </td>
          </>
        )
      }
      default:
        return (
          <td className="text-silver-300 px-4 py-2 font-mono">
            <pre className="whitespace-pre-wrap">{JSON.stringify(row, null, 0)}</pre>
          </td>
        )
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid={`execution-history-${kind}`}>
      {isLoading ? <p className="text-silver-400 p-4 text-sm">Loading…</p> : null}
      {isError ? (
        <p className="p-4 text-sm text-rose-300">Could not load {kind}. Retry from the header.</p>
      ) : null}
      {!isLoading && items.length === 0 ? (
        <p className="text-silver-500 p-4 text-sm">No {kind} for this page.</p>
      ) : null}
      <table className="w-full text-left text-xs">
        <thead className="bg-carbon-950/60 border-carbon-800 border-b text-[10px] font-bold tracking-wider uppercase">
          <tr>{renderHeaders()}</tr>
        </thead>
        <tbody className="divide-carbon-800/60 divide-y">
          {items.map((row) => (
            <tr
              key={'id' in row ? String(row.id) : JSON.stringify(row)}
              className="border-carbon-800 hover:bg-carbon-800/25 border-b transition-colors"
            >
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-carbon-800 flex items-center justify-between border-t p-3">
        <p className="text-silver-500 text-xs">
          Showing {total === 0 ? 0 : pageStart}–{pageEnd} of {total}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={offset === 0}
            onClick={() => onOffsetChange(Math.max(0, offset - EXECUTION_PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={offset + EXECUTION_PAGE_SIZE >= total}
            onClick={() => onOffsetChange(offset + EXECUTION_PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ExecutionWorkspace({ pollingEnabled }: ExecutionWorkspaceProps) {
  const storeActive = useAppStore((s) => s.activeWorkspace === 'execution')
  const isPolling = pollingEnabled ?? storeActive
  const poll = { enabled: isPolling }

  const openExecutionMonitor = useCallback((id: string, name: string) => {
    const url = `/?deployment_id=${encodeURIComponent(id)}`
    if (isTauri()) {
      const windowLabel = `exec-monitor-${id}-${Date.now()}`
      try {
        const monitorWindow = new WebviewWindow(windowLabel, {
          url,
          title: `Execution Monitor - ${name}`,
          width: 1200,
          height: 800,
          resizable: true,
          decorations: false,
          focus: true,
        })
        void monitorWindow.once('tauri://error', (event) => {
          console.error('Failed to open Tauri execution window:', event.payload)
        })
      } catch (err) {
        console.error('Failed to open Tauri execution window:', err)
      }
    } else {
      window.open(url, '_blank', 'width=1200,height=800')
    }
  }, [])

  const healthQuery = useExecutionHealth(poll)
  const killSwitchQuery = useKillSwitch(poll)
  const accountsQuery = usePaperAccounts(poll)

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null)
  const [historyTab, setHistoryTab] = useState<ExecutionHistoryKind>('decisions')
  const [historyOffset, setHistoryOffset] = useState(0)

  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountBalance, setAccountBalance] = useState('100000')

  const [showCreateDeployment, setShowCreateDeployment] = useState(false)
  const [deploymentName, setDeploymentName] = useState('')
  const [selectedBacktestRunId, setSelectedBacktestRunId] = useState<string | null>(null)

  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const activeAccountId = selectedAccountId ?? accountsQuery.data?.items[0]?.id ?? null

  const deploymentsQuery = useDeployments(
    activeAccountId ? { paper_account_id: activeAccountId, limit: 50, offset: 0 } : {},
    { enabled: isPolling && !!activeAccountId },
  )

  const deploymentId = selectedDeploymentId ?? deploymentsQuery.data?.items[0]?.id ?? null
  const deploymentQuery = useDeployment(deploymentId, poll)

  const savedBacktests = useBacktestHistory({ saved_only: true, limit: 20, offset: 0 })

  const createAccount = useCreatePaperAccount()
  const createDeployment = useCreateDeployment()
  const deploymentAction = useDeploymentAction()
  const updateKillSwitch = useUpdateKillSwitch()

  const activeAccount = useMemo(
    () => accountsQuery.data?.items.find((a) => a.id === activeAccountId),
    [accountsQuery.data?.items, activeAccountId],
  )

  const dailyPnl = useMemo(() => {
    if (!activeAccount) return null
    const initial = Number.parseFloat(activeAccount.initial_balance)
    const cash = Number.parseFloat(activeAccount.cash_balance)
    if (Number.isNaN(initial) || Number.isNaN(cash)) return null
    return cash - initial
  }, [activeAccount])

  const health = healthQuery.data
  const deployment = deploymentQuery.data
  const killSwitch = killSwitchQuery.data

  async function handleCreateAccount() {
    try {
      const created = await createAccount.mutateAsync({
        name: accountName.trim(),
        initial_balance: accountBalance.trim(),
        currency: 'BRL',
      })
      setSelectedAccountId(created.id)
      setShowCreateAccount(false)
      setAccountName('')
    } catch (err) {
      setActionError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.detail ?? err.message)
          : 'Failed to create account',
      )
    }
  }

  async function handleCreateDeployment() {
    if (!activeAccountId || !selectedBacktestRunId) return
    try {
      const created = await createDeployment.mutateAsync({
        paper_account_id: activeAccountId,
        name: deploymentName.trim(),
        broker_mode: 'paper',
        live_activation_enabled: false,
        source_backtest_run_id: selectedBacktestRunId,
      })
      setSelectedDeploymentId(created.id)
      setShowCreateDeployment(false)
      setDeploymentName('')
    } catch (err) {
      setActionError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.detail ?? err.message)
          : 'Failed to create deployment',
      )
    }
  }

  async function runLifecycleAction(action: 'start' | 'pause' | 'stop') {
    if (!deploymentId) return
    setActionError(null)
    setActionFeedback(null)
    try {
      const result = await deploymentAction.mutateAsync({
        deploymentId,
        body: { action, confirm: false },
      })
      setActionFeedback(result.message)
      if (!result.accepted) {
        setActionError(result.message)
      }
    } catch (err) {
      setActionError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.detail ?? err.message)
          : 'Command rejected',
      )
    }
  }

  async function runFlatten() {
    if (!deploymentId) return
    setActionError(null)
    setActionFeedback(null)
    try {
      const result = await deploymentAction.mutateAsync({
        deploymentId,
        body: { action: 'flatten', confirm: true },
      })
      setActionFeedback(result.message)
      if (!result.accepted) {
        setActionError(result.message)
      }
    } catch (err) {
      setActionError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.detail ?? err.message)
          : 'Flatten rejected',
      )
    } finally {
      setConfirmKind(null)
    }
  }

  async function runKillSwitch(enable: boolean) {
    setActionError(null)
    try {
      const result = await updateKillSwitch.mutateAsync({
        enabled: enable,
        confirm: enable,
        reason: enable ? 'Operator engaged kill switch from Execution workspace' : undefined,
        updated_by: 'operator',
      })
      if (!result.accepted) {
        setActionError('Kill switch update was not accepted')
      }
    } catch (err) {
      setActionError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.detail ?? err.message)
          : 'Kill switch rejected',
      )
    }
  }

  return (
    <div
      className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-4 overflow-hidden p-1"
      data-testid="execution-workspace"
      data-workspace-transition-root="execution"
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className="text-brass-400 text-xl font-bold"
              data-workspace-transition-anchor="execution"
            >
              Execution
            </h1>
            <EnvironmentBadges />
          </div>
          <p className="text-silver-400 mt-1 text-sm">
            Paper execution control plane — inspect deployments, positions, and audit history. Open
            positions remain after pause or stop until you flatten.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => healthQuery.refetch()}>
          Refresh
        </Button>
      </div>

      {healthQuery.isLoading ? (
        <p className="text-silver-400 text-sm" data-testid="execution-loading">
          Loading execution health…
        </p>
      ) : null}

      {health ? (
        <HealthSignals
          apiStatus={health.api_status}
          workerStatus={health.worker_status}
          marketStatus={health.market_data_status}
          unknownOrders={health.unknown_order_count}
        />
      ) : null}

      <div className="grid shrink-0 gap-4 lg:grid-cols-2">
        <Panel className="p-4" living data-workspace-transition-surface="secondary">
          <PanelHeader title="Global kill switch" />
          <p className="text-silver-400 -mt-1 mb-3 text-xs">
            Halts new risk across paper deployments. Requires explicit confirmation to enable.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-bold tracking-wider uppercase',
                killSwitch?.enabled
                  ? 'animate-pulse border-rose-500/25 bg-rose-500/15 text-rose-300'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
              )}
              data-testid="execution-kill-switch-state"
            >
              {killSwitch?.enabled ? 'Engaged' : 'Off'}
            </span>
            {killSwitch?.enabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-silver-500/30 text-silver-300 hover:bg-silver-500/10 transition-all duration-150 active:scale-95"
                disabled={updateKillSwitch.isPending}
                onClick={() => void runKillSwitch(false)}
                data-testid="execution-kill-switch-release"
              >
                Release kill switch
              </Button>
            ) : (
              <PowerOffSlide
                submitting={updateKillSwitch.isPending}
                confirmed={Boolean(killSwitch?.enabled)}
                rejected={Boolean(actionError)}
                onConfirm={() => void runKillSwitch(true)}
              />
            )}
          </div>
        </Panel>

        <Panel className="p-4" living>
          <PanelHeader title="Paper account" />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {accountsQuery.data?.items.map((account) => (
              <button
                key={account.id}
                type="button"
                className={cn(
                  chipClass(account.id === activeAccountId),
                  'transition-all duration-150 active:scale-95',
                )}
                onClick={() => {
                  setSelectedAccountId(account.id)
                  setSelectedDeploymentId(null)
                }}
              >
                {account.name}
              </button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-brass-400 hover:text-brass-350 hover:bg-brass-500/10 transition-colors"
              onClick={() => setShowCreateAccount(true)}
            >
              + Account
            </Button>
          </div>
          {activeAccount ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                label="Cash balance"
                value={Number(activeAccount.cash_balance).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: activeAccount.currency,
                })}
              />
              <StatTile
                label="Equity (cash)"
                value={Number(activeAccount.cash_balance).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: activeAccount.currency,
                })}
                delta="Uses worker quotes when a position is open"
              />
              <StatTile
                label="Session P&L vs initial"
                value={
                  dailyPnl == null
                    ? '—'
                    : `${dailyPnl >= 0 ? '+' : ''}${dailyPnl.toLocaleString('pt-BR', { style: 'currency', currency: activeAccount.currency })}`
                }
                valueTone={dailyPnl != null && dailyPnl >= 0 ? 'up' : 'down'}
              />
            </div>
          ) : (
            <p className="text-silver-500 text-sm">Create a paper account to begin.</p>
          )}
        </Panel>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
        <Panel
          className="flex min-h-0 flex-col p-0"
          living
          data-workspace-transition-surface="tertiary"
        >
          <PanelHeader
            title="Deployments"
            right={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-brass-400 hover:text-brass-350 hover:bg-brass-500/10 text-xs font-medium transition-colors"
                disabled={!activeAccountId}
                onClick={() => setShowCreateDeployment(true)}
              >
                + New
              </Button>
            }
          />
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {deploymentsQuery.isLoading ? (
              <p className="text-silver-400 p-2 text-sm">Loading deployments…</p>
            ) : null}
            {(deploymentsQuery.data?.items ?? []).map((item) => {
              const isSelected = item.id === deploymentId
              let statusBorder = 'border-l-rose-500'
              if (item.lifecycle === 'running') {
                statusBorder = 'border-l-emerald-500'
              } else if (item.lifecycle === 'paused' || item.lifecycle === 'draft') {
                statusBorder = 'border-l-amber-500'
              }

              return (
                <GlowCard
                  key={item.id}
                  intensity="card"
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'hover:bg-carbon-800/40 mb-2 w-full cursor-pointer rounded-lg border-l-4 p-3 text-left transition-all duration-155',
                    statusBorder,
                    isSelected ? 'bg-brass-500/5 shadow-[0_0_12px_rgba(217,158,34,0.08)]' : null,
                  )}
                  onClick={() => setSelectedDeploymentId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedDeploymentId(item.id)
                    }
                  }}
                  data-testid={`execution-deployment-${item.id}`}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p
                        className={cn(
                          'truncate text-sm font-semibold transition-colors',
                          isSelected ? 'text-brass-400' : 'text-silver-100',
                        )}
                      >
                        {item.name}
                      </p>
                      <button
                        type="button"
                        title="Open monitor window"
                        className="text-silver-500 hover:text-brass-400 shrink-0 cursor-pointer rounded p-0.5 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          openExecutionMonitor(item.id, item.name)
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase',
                        item.lifecycle === 'running'
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                          : item.lifecycle === 'paused'
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                            : 'border-rose-500/25 bg-rose-500/10 text-rose-300',
                      )}
                    >
                      {item.lifecycle}
                    </span>
                  </div>
                  <p className="text-silver-400 mt-1.5 flex items-center gap-1.5 font-mono text-[11px]">
                    <span>{item.symbol}</span>
                    <span className="text-carbon-600">·</span>
                    <span>{item.timeframe}</span>
                  </p>
                  {item.pending_action ? (
                    <div className="mt-2 flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[11px] text-amber-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                      <span>Pending: {item.pending_action}</span>
                    </div>
                  ) : null}
                </GlowCard>
              )
            })}
            {(deploymentsQuery.data?.items.length ?? 0) === 0 && !deploymentsQuery.isLoading ? (
              <p className="text-silver-500 p-2 text-sm">No deployments yet.</p>
            ) : null}
          </div>
        </Panel>

        <div className="flex min-h-0 flex-col gap-4">
          <Panel className="p-4" living>
            <PanelHeader title="Deployment control" />
            {deployment ? (
              <>
                <div className="border-carbon-800 mb-4 flex flex-wrap gap-x-4 gap-y-2 border-b pb-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-silver-400">Current Status:</span>
                    <span
                      className={cn(
                        'rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                        deployment.lifecycle === 'running'
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                          : deployment.lifecycle === 'paused'
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                            : 'border-rose-500/25 bg-rose-500/10 text-rose-400',
                      )}
                    >
                      {deployment.lifecycle}
                    </span>
                  </div>
                  {deployment.pending_action ? (
                    <div className="text-amber-350 flex items-center gap-1.5 rounded border border-amber-500/15 bg-amber-500/5 px-2 py-0.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                      <span>Desired: {deployment.pending_action}</span>
                    </div>
                  ) : null}
                  {deployment.last_bar_close_time ? (
                    <div className="text-silver-500 flex items-center gap-1">
                      <span>Last bar:</span>
                      <span className="font-mono">
                        {formatDisplayDateTime(deployment.last_bar_close_time)}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer bg-emerald-600 font-semibold text-white shadow-lg shadow-emerald-950/20 transition-colors hover:bg-emerald-700 active:scale-95"
                    onClick={() => void runLifecycleAction('start')}
                  >
                    Start
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer border-amber-500/30 font-semibold text-amber-300 transition-colors hover:border-amber-500 hover:bg-amber-500/10 active:scale-95"
                    onClick={() => void runLifecycleAction('pause')}
                  >
                    Pause
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer border-rose-500/30 font-semibold text-rose-300 transition-colors hover:border-rose-500 hover:bg-rose-500/10 active:scale-95"
                    onClick={() => void runLifecycleAction('stop')}
                  >
                    Stop
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-brass-500/30 text-brass-300 hover:bg-brass-500/10 hover:border-brass-450 flex cursor-pointer items-center gap-1.5 font-semibold transition-colors active:scale-95"
                    onClick={() => openExecutionMonitor(deployment.id, deployment.name)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Monitor Live</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto cursor-pointer border-red-500/40 bg-red-950/15 font-semibold text-red-200 transition-all hover:border-red-500 hover:bg-red-950/30 hover:text-red-100 active:scale-95"
                    onClick={() => setConfirmKind('flatten')}
                  >
                    Flatten
                  </Button>
                </div>
                <p
                  className="text-silver-400 bg-carbon-900/40 border-carbon-800 mt-4 rounded-lg border p-2.5 text-xs leading-relaxed"
                  data-testid="execution-retained-position-note"
                >
                  Pause and stop halt new entries; open positions remain until you flatten or the
                  worker closes them per strategy exits.
                </p>
                {deployment.open_position ? (
                  <div
                    className={cn(
                      'bg-carbon-900/50 mt-4 rounded-lg border-y border-r border-l-4 p-4 shadow-md',
                      deployment.open_position.side === 'long'
                        ? 'border-y-emerald-950/20 border-r-emerald-950/20 border-l-emerald-500'
                        : 'border-y-rose-950/20 border-r-rose-950/20 border-l-rose-500',
                    )}
                    data-testid="execution-open-position"
                  >
                    <div className="border-carbon-800 mb-3 flex items-center justify-between border-b pb-2">
                      <p className="text-silver-100 flex items-center gap-1.5 text-sm font-bold">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            deployment.open_position.side === 'long'
                              ? 'bg-emerald-400'
                              : 'bg-rose-400',
                          )}
                        />
                        <span>Open Position</span>
                      </p>
                      <span
                        className={cn(
                          'rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                          deployment.open_position.side === 'long'
                            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                            : 'border-rose-500/25 bg-rose-500/10 text-rose-300',
                        )}
                      >
                        {deployment.open_position.side}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-silver-500 text-[10px] font-semibold tracking-wider uppercase">
                          Quantity
                        </p>
                        <p className="text-silver-100 mt-0.5 font-mono text-base font-bold">
                          {deployment.open_position.quantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-silver-500 text-[10px] font-semibold tracking-wider uppercase">
                          Avg Entry Price
                        </p>
                        <p className="text-silver-100 mt-0.5 font-mono text-base font-bold">
                          {deployment.open_position.average_entry_price ?? '—'}
                        </p>
                      </div>
                    </div>
                    <p className="text-silver-500 border-carbon-800/60 mt-3 border-t pt-2.5 text-xs leading-relaxed italic">
                      Mark-to-market updates when the worker receives fresh quotes — not simulated
                      here.
                    </p>
                  </div>
                ) : (
                  <div className="border-carbon-800 bg-carbon-950/20 text-silver-450 mt-4 flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
                    <span className="bg-silver-500 h-2 w-2 rounded-full" />
                    <span>Flat — no open net position.</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-silver-500 py-2 text-sm">Select a deployment.</p>
            )}
            {actionFeedback ? (
              <div
                className="text-emerald-350 mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-2.5 text-sm"
                data-testid="execution-action-feedback"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>{actionFeedback}</span>
              </div>
            ) : null}
            {actionError ? (
              <div
                className="text-rose-350 mt-3 flex items-center gap-2 rounded-lg border border-rose-500/15 bg-rose-500/5 p-2.5 text-sm"
                data-testid="execution-action-error"
              >
                <span className="bg-rose-450 h-1.5 w-1.5 rounded-full" />
                <span>{actionError}</span>
              </div>
            ) : null}
          </Panel>

          <ExecutionLiveChartPanel
            deploymentId={deploymentId}
            symbol={deployment?.symbol ?? null}
            pollingEnabled={isPolling}
          />

          <Panel
            className="flex min-h-0 flex-1 flex-col p-0"
            living
            data-workspace-transition-surface="utility"
          >
            <PanelHeader title="History" />
            <div className="border-carbon-800 shrink-0 border-b px-3 py-2">
              <SegmentedToggle
                aria-label="Execution history tabs"
                value={historyTab}
                onChange={(val) => {
                  setHistoryTab(val as ExecutionHistoryKind)
                  setHistoryOffset(0)
                }}
                options={HISTORY_TABS}
              />
            </div>
            <PaginatedHistoryTable
              kind={historyTab}
              deploymentId={deploymentId}
              accountId={activeAccountId}
              offset={historyOffset}
              onOffsetChange={setHistoryOffset}
              pollingEnabled={isPolling}
            />
          </Panel>
        </div>
      </div>

      {showCreateAccount ? (
        <div className="surface-overlay-scrim fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="surface-overlay w-full max-w-md rounded-xl p-5">
            <h3 className="text-silver-100 text-lg font-semibold">Create paper account</h3>
            <div className="mt-4 space-y-3">
              <LabeledField label="Name" htmlFor="exec-account-name">
                <input
                  id="exec-account-name"
                  className={wellInputClass}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </LabeledField>
              <LabeledField label="Initial balance" htmlFor="exec-account-balance">
                <input
                  id="exec-account-balance"
                  className={wellInputClass}
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(e.target.value)}
                />
              </LabeledField>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreateAccount(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!accountName.trim() || createAccount.isPending}
                onClick={() => void handleCreateAccount()}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateDeployment ? (
        <div className="surface-overlay-scrim fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="surface-overlay w-full max-w-lg rounded-xl p-5">
            <h3 className="text-silver-100 text-lg font-semibold">Create deployment</h3>
            <p className="text-silver-400 mt-1 text-sm">
              Promote a saved backtest run — strategy identity and config hash are resolved by the
              backend.
            </p>
            <div className="mt-4 space-y-3">
              <LabeledField label="Name" htmlFor="exec-deploy-name">
                <input
                  id="exec-deploy-name"
                  className={wellInputClass}
                  value={deploymentName}
                  onChange={(e) => setDeploymentName(e.target.value)}
                />
              </LabeledField>
              <LabeledField label="Saved backtest run" htmlFor="exec-deploy-run">
                <select
                  id="exec-deploy-run"
                  className={wellInputClass}
                  value={selectedBacktestRunId ?? ''}
                  onChange={(e) => setSelectedBacktestRunId(e.target.value || null)}
                >
                  <option value="">Select a saved run…</option>
                  {(savedBacktests.data?.items ?? []).map((run) => (
                    <option key={run.run_id} value={run.run_id}>
                      {run.strategy} · {run.symbol} · {run.timeframe}
                    </option>
                  ))}
                </select>
              </LabeledField>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreateDeployment(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  !deploymentName.trim() || !selectedBacktestRunId || createDeployment.isPending
                }
                onClick={() => void handleCreateDeployment()}
                data-testid="execution-create-deployment-submit"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmKind === 'flatten'}
        title="Flatten deployment?"
        description="This queues a worker flatten for all open positions on this deployment. The UI will not mark positions closed until the backend confirms fills."
        confirmLabel="Flatten positions"
        loading={deploymentAction.isPending}
        onConfirm={() => void runFlatten()}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  )
}
