import { useBackendConnection } from '@/api/queries/backendConnection'
import { BACKEND_START_COMMAND } from '@/lib/backend/connectionStatus'

export function BackendStatusIndicator() {
  const connection = useBackendConnection()

  if (connection.state === 'mocked') {
    return (
      <span
        role="status"
        className="surface-control text-silver-300 border-brass-600/15 rounded-lg border px-2 py-1 font-mono text-[9px] tracking-wider"
      >
        Mock data
      </span>
    )
  }

  if (connection.state === 'connected') {
    return (
      <span
        role="status"
        className="surface-control flex items-center gap-1.5 rounded-lg border border-emerald-500/20 px-2 py-1 font-mono text-[9px] tracking-wider text-emerald-400"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Connected
      </span>
    )
  }

  if (connection.state === 'degraded') {
    const failingNames = connection.failing
      .map((s) => (s === 'postgres' ? 'Postgres' : 'Redis'))
      .join(', ')

    return (
      <span
        role="status"
        className="surface-control flex items-center gap-1.5 rounded-lg border border-amber-500/20 px-2 py-1 font-mono text-[9px] tracking-wider text-amber-400"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
        Degraded ({failingNames})
      </span>
    )
  }

  return (
    <span
      role="status"
      className="surface-control flex items-center gap-2 rounded-lg border border-rose-500/20 px-2 py-1 font-mono text-[9px] tracking-wider text-rose-400"
    >
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
      <span>Offline</span>
      <span className="text-silver-400 font-mono">{connection.apiBaseUrl}</span>
      <code className="text-silver-300 border-silver-400/10 rounded border bg-black/30 px-1 py-0.5 text-[8.5px]">
        {BACKEND_START_COMMAND}
      </code>
    </span>
  )
}
