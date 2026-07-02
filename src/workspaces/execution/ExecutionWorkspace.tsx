import axios from 'axios'
import { useMemo, useState } from 'react'

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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LabeledField } from '@/components/ui/LabeledField'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { StatTile } from '@/components/ui/StatTile'
import { Button } from '@/components/ui/button'
import { chipClass } from '@/components/ui/chipStyles'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { ExecutionHistoryKind } from '@/types/execution'

type ExecutionWorkspaceProps = {
  /** When false, all execution polling stops (route visibility guard). */
  pollingEnabled?: boolean
}

type ConfirmKind = 'flatten' | 'kill_switch_on' | null

const HISTORY_TABS: { value: ExecutionHistoryKind; label: string }[] = [
  { value: 'decisions', label: 'Decisions' },
  { value: 'orders', label: 'Orders' },
  { value: 'fills', label: 'Fills' },
  { value: 'ledger', label: 'Ledger' },
  { value: 'risk-events', label: 'Risk' },
]

function statusTone(status: string): string {
  if (status === 'healthy' || status === 'ok' || status === 'online' || status === 'running') {
    return 'text-emerald-400'
  }
  if (status === 'stale' || status === 'degraded' || status === 'paused') {
    return 'text-amber-400'
  }
  return 'text-rose-400'
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
    <Panel className="p-4" data-testid="execution-health-panel">
      <p className="text-silver-400 mb-3 text-xs">
        API reachability is separate from worker heartbeat and market-data freshness.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="API" value={apiStatus} valueTone="neutral" />
        <StatTile label="Worker" value={workerStatus} />
        <StatTile label="Market data" value={marketStatus} />
        <StatTile
          label="Unknown orders"
          value={String(unknownOrders)}
          valueTone={unknownOrders > 0 ? 'down' : 'neutral'}
          highlight={unknownOrders > 0}
        />
      </div>
      {apiStatus === 'ok' && workerStatus === 'offline' ? (
        <p className="mt-3 text-sm text-amber-300" data-testid="execution-worker-down-banner">
          Control API is up, but no healthy worker lease was detected. Lifecycle commands may queue
          until a worker reconnects.
        </p>
      ) : null}
      {unknownOrders > 0 ? (
        <p className="mt-3 text-sm text-rose-300" data-testid="execution-unknown-orders-banner">
          {unknownOrders} order(s) need reconciliation — inspect the Orders tab and worker logs
          before flattening.
        </p>
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
        <tbody>
          {items.map((row) => (
            <tr
              key={'id' in row ? String(row.id) : JSON.stringify(row)}
              className="border-carbon-800 border-b"
            >
              <td className="text-silver-300 p-2 font-mono">
                <pre className="whitespace-pre-wrap">{JSON.stringify(row, null, 0)}</pre>
              </td>
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
    } finally {
      setConfirmKind(null)
    }
  }

  return (
    <div
      className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-4 overflow-hidden p-1"
      data-testid="execution-workspace"
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-brass-400 text-xl font-bold">Execution</h1>
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
        <Panel className="p-4">
          <PanelHeader title="Global kill switch" />
          <p className="text-silver-400 -mt-1 mb-3 text-xs">
            Halts new risk across paper deployments. Requires explicit confirmation to enable.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                'rounded-md px-2 py-1 text-xs font-semibold uppercase',
                killSwitch?.enabled
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-emerald-500/10 text-emerald-300',
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
                disabled={updateKillSwitch.isPending}
                onClick={() => void runKillSwitch(false)}
              >
                Release kill switch
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-rose-500/40 text-rose-300"
                onClick={() => setConfirmKind('kill_switch_on')}
              >
                Engage kill switch
              </Button>
            )}
          </div>
        </Panel>

        <Panel className="p-4">
          <PanelHeader title="Paper account" />
          <div className="mb-3 flex flex-wrap gap-2">
            {accountsQuery.data?.items.map((account) => (
              <button
                key={account.id}
                type="button"
                className={chipClass(account.id === activeAccountId)}
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
              onClick={() => setShowCreateAccount(true)}
            >
              + Account
            </Button>
          </div>
          {activeAccount ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Cash balance" value={activeAccount.cash_balance} />
              <StatTile
                label="Equity (cash)"
                value={activeAccount.cash_balance}
                delta="Mark-to-market uses worker quotes when a position is open"
              />
              <StatTile
                label="Session P&L vs initial"
                value={dailyPnl == null ? '—' : dailyPnl.toFixed(2)}
                valueTone={dailyPnl != null && dailyPnl >= 0 ? 'up' : 'down'}
              />
            </div>
          ) : (
            <p className="text-silver-500 text-sm">Create a paper account to begin.</p>
          )}
        </Panel>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
        <Panel className="flex min-h-0 flex-col p-0">
          <PanelHeader
            title="Deployments"
            right={
              <Button
                type="button"
                variant="ghost"
                size="sm"
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
            {(deploymentsQuery.data?.items ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'surface-card mb-2 w-full rounded-lg border p-3 text-left transition-colors',
                  item.id === deploymentId ? 'border-brass-500/50' : 'border-transparent',
                )}
                onClick={() => setSelectedDeploymentId(item.id)}
                data-testid={`execution-deployment-${item.id}`}
              >
                <p className="text-silver-100 text-sm font-semibold">{item.name}</p>
                <p className="text-silver-500 mt-1 text-xs">
                  {item.symbol} · {item.timeframe} ·{' '}
                  <span className={statusTone(item.lifecycle)}>{item.lifecycle}</span>
                </p>
                {item.pending_action ? (
                  <p className="mt-1 text-xs text-amber-300">Pending: {item.pending_action}</p>
                ) : null}
              </button>
            ))}
            {(deploymentsQuery.data?.items.length ?? 0) === 0 && !deploymentsQuery.isLoading ? (
              <p className="text-silver-500 p-2 text-sm">No deployments yet.</p>
            ) : null}
          </div>
        </Panel>

        <div className="flex min-h-0 flex-col gap-4">
          <Panel className="p-4">
            <PanelHeader title="Deployment control" />
            {deployment ? (
              <>
                <div className="mb-3 flex flex-wrap gap-2 text-xs">
                  <span className="text-silver-400">
                    Current:{' '}
                    <strong className={statusTone(deployment.lifecycle)}>
                      {deployment.lifecycle}
                    </strong>
                  </span>
                  {deployment.pending_action ? (
                    <span className="text-amber-300">Desired: {deployment.pending_action}</span>
                  ) : null}
                  {deployment.last_bar_close_time ? (
                    <span className="text-silver-500">
                      Last bar {formatDisplayDateTime(deployment.last_bar_close_time)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void runLifecycleAction('start')}>
                    Start
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runLifecycleAction('pause')}
                  >
                    Pause
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runLifecycleAction('stop')}
                  >
                    Stop
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-rose-500/40 text-rose-300"
                    onClick={() => setConfirmKind('flatten')}
                  >
                    Flatten
                  </Button>
                </div>
                <p
                  className="text-silver-500 mt-3 text-xs"
                  data-testid="execution-retained-position-note"
                >
                  Pause and stop halt new entries; open positions remain until you flatten or the
                  worker closes them per strategy exits.
                </p>
                {deployment.open_position ? (
                  <div
                    className="surface-card mt-4 rounded-lg border p-3"
                    data-testid="execution-open-position"
                  >
                    <p className="text-silver-300 text-sm font-semibold">Open position</p>
                    <p className="text-silver-400 mt-1 font-mono text-xs">
                      {deployment.open_position.side} {deployment.open_position.quantity} @{' '}
                      {deployment.open_position.average_entry_price ?? '—'}
                    </p>
                    <p className="text-silver-500 mt-1 text-xs">
                      Mark-to-market updates when the worker receives fresh quotes — not simulated
                      here.
                    </p>
                  </div>
                ) : (
                  <p className="text-silver-500 mt-3 text-sm">Flat — no open net position.</p>
                )}
              </>
            ) : (
              <p className="text-silver-500 text-sm">Select a deployment.</p>
            )}
            {actionFeedback ? (
              <p className="mt-3 text-sm text-emerald-300" data-testid="execution-action-feedback">
                {actionFeedback}
              </p>
            ) : null}
            {actionError ? (
              <p className="mt-3 text-sm text-rose-300" data-testid="execution-action-error">
                {actionError}
              </p>
            ) : null}
          </Panel>

          <ExecutionLiveChartPanel
            deploymentId={deploymentId}
            symbol={deployment?.symbol ?? null}
            pollingEnabled={isPolling}
          />

          <Panel className="flex min-h-0 flex-1 flex-col p-0">
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

      <ConfirmDialog
        open={confirmKind === 'kill_switch_on'}
        title="Engage global kill switch?"
        description="Paper deployments will stop accepting new risk. Existing positions remain until flattened. This requires backend confirmation."
        confirmLabel="Engage kill switch"
        loading={updateKillSwitch.isPending}
        onConfirm={() => void runKillSwitch(true)}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  )
}
