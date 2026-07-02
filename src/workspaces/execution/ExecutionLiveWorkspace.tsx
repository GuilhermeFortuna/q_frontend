import { useMemo } from 'react'
import { useDeployment, usePaperAccounts } from '@/api/queries/execution'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/ui/Panel'
import { ReaderWindowShell } from '@/components/layout/ReaderWindowShell'
import { ExecutionLiveChartPanel } from '@/workspaces/execution/ExecutionLiveChartPanel'
import { Activity, Cpu, Shield, Wallet } from 'lucide-react'

type ExecutionLiveWorkspaceProps = {
  deploymentId: string
}

export function ExecutionLiveWorkspace({ deploymentId }: ExecutionLiveWorkspaceProps) {
  const deploymentQuery = useDeployment(deploymentId, { enabled: !!deploymentId })
  const accountsQuery = usePaperAccounts({ enabled: !!deploymentId })

  const deployment = deploymentQuery.data
  const activeAccount = useMemo(() => {
    if (!deployment || !accountsQuery.data) return null
    return accountsQuery.data.items.find((a) => a.id === deployment.paper_account_id)
  }, [deployment, accountsQuery.data])

  const dailyPnl = useMemo(() => {
    if (!activeAccount) return null
    const initial = Number.parseFloat(activeAccount.initial_balance)
    const cash = Number.parseFloat(activeAccount.cash_balance)
    if (Number.isNaN(initial) || Number.isNaN(cash)) return null
    return cash - initial
  }, [activeAccount])

  if (deploymentQuery.isLoading || accountsQuery.isLoading) {
    return (
      <ReaderWindowShell title="Execution Monitor" tag="Loading">
        <div className="flex h-full items-center justify-center">
          <div className="border-brass-600/15 bg-carbon-900/50 text-silver-300 flex items-center gap-3 rounded-lg border px-5 py-3 font-mono text-sm shadow-md">
            <span className="bg-brass-400 h-2 w-2 animate-ping rounded-full" />
            Loading deployment monitor...
          </div>
        </div>
      </ReaderWindowShell>
    )
  }

  if (deploymentQuery.isError || !deployment) {
    return (
      <ReaderWindowShell title="Execution Monitor" tag="Error">
        <div className="flex h-full flex-col items-center justify-center text-center p-4">
          <div className="max-w-md rounded-lg border border-rose-500/10 bg-rose-500/5 p-6 font-mono text-rose-400 shadow-lg">
            <h2 className="mb-2 text-base font-bold tracking-wider uppercase">
              Deployment Not Found
            </h2>
            <p className="text-sm opacity-95">
              Could not retrieve deployment details for ID: {deploymentId}
            </p>
          </div>
        </div>
      </ReaderWindowShell>
    )
  }

  return (
    <ReaderWindowShell
      title={`Monitor - ${deployment.name}`}
      tag="Live execution"
      mainClassName="animate-fade-in-up relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden px-6 pb-6 pt-4"
    >
      <div className="grid h-full min-h-0 flex-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Left Side: Strategy Details */}
        <Panel className="flex min-h-0 flex-col overflow-y-auto p-4 gap-4" living>
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-carbon-800 pb-2.5">
              <h2 className="text-brass-400 text-sm font-bold truncate pr-2" title={deployment.name}>
                {deployment.name}
              </h2>
              <span className={cn(
                'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
                deployment.lifecycle === 'running'
                  ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/25'
                  : deployment.lifecycle === 'paused'
                    ? 'bg-amber-500/10 text-amber-450 border-amber-500/25'
                    : 'bg-rose-500/10 text-rose-450 border-rose-500/25'
              )}>
                {deployment.lifecycle}
              </span>
            </div>
            
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-carbon-900/40 border border-carbon-800/60 rounded p-2">
                <span className="text-silver-500 text-[10px] uppercase font-semibold">Symbol</span>
                <p className="text-silver-200 font-mono font-medium mt-0.5">{deployment.symbol}</p>
              </div>
              <div className="bg-carbon-900/40 border border-carbon-800/60 rounded p-2">
                <span className="text-silver-500 text-[10px] uppercase font-semibold">Timeframe</span>
                <p className="text-silver-200 font-mono font-medium mt-0.5">{deployment.timeframe}</p>
              </div>
            </div>
          </div>

          {/* Position Section */}
          <div className="border-t border-carbon-800 pt-3">
            <h4 className="text-silver-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-brass-500" />
              <span>Active Position</span>
            </h4>
            {deployment.open_position ? (
              <div className={cn(
                "rounded-lg border-y border-r border-l-4 p-3 bg-carbon-900/40",
                deployment.open_position.side === 'long' 
                  ? 'border-l-emerald-500 border-y-emerald-950/20 border-r-emerald-950/20' 
                  : 'border-l-rose-500 border-y-rose-950/20 border-r-rose-950/20'
              )}>
                <div className="flex items-center justify-between border-b border-carbon-800/60 pb-1.5 mb-2">
                  <span className="text-silver-200 text-xs font-semibold capitalize">{deployment.open_position.side} position</span>
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border",
                    deployment.open_position.side === 'long'
                      ? "bg-emerald-500/10 text-emerald-350 border-emerald-500/25"
                      : "bg-rose-500/10 text-rose-355 border-rose-500/25"
                  )}>
                    {deployment.open_position.quantity} units
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-silver-500">Avg Entry Price</span>
                  <span className="text-silver-100 font-mono font-bold">{deployment.open_position.average_entry_price ?? '—'}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-carbon-800 bg-carbon-950/10 p-3 text-silver-450 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-silver-500" />
                <span>Flat — no open net position.</span>
              </div>
            )}
          </div>

          {/* Account & Performance */}
          {activeAccount && (
            <div className="border-t border-carbon-800 pt-3">
              <h4 className="text-silver-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-brass-500" />
                <span>Account: {activeAccount.name}</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-carbon-900/30 p-2 rounded border border-carbon-850">
                  <span className="text-silver-500">Cash Balance</span>
                  <span className="text-silver-200 font-mono font-semibold">
                    {Number(activeAccount.cash_balance).toLocaleString('pt-BR', { style: 'currency', currency: activeAccount.currency })}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-carbon-900/30 p-2 rounded border border-carbon-850">
                  <span className="text-silver-500">Session P&L</span>
                  <span className={cn(
                    "font-mono font-bold",
                    dailyPnl != null && dailyPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {dailyPnl == null ? '—' : `${dailyPnl >= 0 ? '+' : ''}${dailyPnl.toLocaleString('pt-BR', { style: 'currency', currency: activeAccount.currency })}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Strategy compiled parameters */}
          <div className="border-t border-carbon-800 pt-3">
            <h4 className="text-silver-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-brass-500" />
              <span>Strategy parameters</span>
            </h4>
            <div className="bg-carbon-900/40 border border-carbon-800/60 rounded p-2.5 space-y-1.5 font-mono text-[11px] text-silver-300">
              <div className="flex justify-between border-b border-carbon-800/40 pb-1">
                <span className="text-silver-500">Strategy</span>
                <span className="text-silver-100 font-semibold">{deployment.strategy_name}</span>
              </div>
              <div className="flex justify-between border-b border-carbon-800/40 pb-1">
                <span className="text-silver-500">Version</span>
                <span className="text-silver-200">v{deployment.strategy_version}</span>
              </div>
              {Object.entries(deployment.compiled_config?.strategy_params || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-carbon-800/40 last:border-0 pb-1 last:pb-0">
                  <span className="text-silver-500">{k}</span>
                  <span className="text-silver-200 font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk settings */}
          <div className="border-t border-carbon-800 pt-3">
            <h4 className="text-silver-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-brass-500" />
              <span>Risk & sizing limits</span>
            </h4>
            <div className="bg-carbon-900/40 border border-carbon-800/60 rounded p-2.5 space-y-1.5 font-mono text-[11px] text-silver-300">
              {Object.entries(deployment.sizing_config || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-carbon-800/40 pb-1">
                  <span className="text-silver-500">Size: {k}</span>
                  <span className="text-silver-200">{String(v)}</span>
                </div>
              ))}
              {Object.entries(deployment.risk_config || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-carbon-800/40 last:border-0 pb-1 last:pb-0">
                  <span className="text-silver-500">Risk: {k.replace('_', ' ')}</span>
                  <span className="text-silver-200">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Latest Decision */}
          {deployment.latest_decision && (
            <div className="border-t border-carbon-800 pt-3 mt-auto">
              <h4 className="text-silver-500 text-[10px] uppercase font-bold tracking-wider mb-1">
                Latest Decision
              </h4>
              <div className="bg-carbon-900/30 border border-carbon-850 rounded p-2 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-silver-500 text-[11px]">Action</span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border",
                    deployment.latest_decision.signal_action === 'buy'
                      ? "bg-emerald-500/10 text-emerald-350 border-emerald-500/25"
                      : deployment.latest_decision.signal_action === 'sell'
                        ? "bg-rose-500/10 text-rose-355 border-rose-500/25"
                        : "bg-silver-500/10 text-silver-300 border-silver-500/25"
                  )}>
                    {deployment.latest_decision.signal_action}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-silver-500">Outcome</span>
                  <span className="text-silver-350">{deployment.latest_decision.outcome}</span>
                </div>
                {deployment.latest_decision.reason && (
                  <p className="text-silver-400 mt-1 text-[11px] italic leading-snug border-t border-carbon-850 pt-1">
                    {deployment.latest_decision.reason}
                  </p>
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* Right Side: Fullscreen Live Chart */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ExecutionLiveChartPanel
            deploymentId={deploymentId}
            symbol={deployment.symbol}
            pollingEnabled={true}
            className="flex-1 flex flex-col min-h-0"
            chartHeight="100%"
          />
        </div>
      </div>
    </ReaderWindowShell>
  )
}
