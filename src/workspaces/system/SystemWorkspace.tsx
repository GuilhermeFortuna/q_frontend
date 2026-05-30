import { useSystemHealth } from '@/api/queries/system'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { env } from '@/lib/env'

export function SystemWorkspace() {
  const { data: health, isLoading, isError, refetch, isFetching } = useSystemHealth()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium text-silver-100">System</h1>
        <p className="text-sm text-silver-400">
          Runtime configuration and backend connectivity (mock API in Phase 1).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>Frontend runtime targets</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-carbon-700 pb-2">
              <dt className="text-silver-400">API base URL</dt>
              <dd className="font-mono text-silver-100">{env.apiBaseUrl}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-carbon-700 pb-2">
              <dt className="text-silver-400">MSW mocks</dt>
              <dd className="font-mono text-silver-100">{env.enableMsw ? 'enabled' : 'disabled'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-silver-400">Build mode</dt>
              <dd className="font-mono text-silver-100">{env.isDev ? 'development' : 'production'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Backend health</CardTitle>
            <CardDescription>GET /api/v1/system/health</CardDescription>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="text-xs text-brass-400 hover:text-brass-500 disabled:opacity-50"
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-silver-400">Loading health…</p>
          ) : isError || !health ? (
            <p className="text-sm text-red-300">
              Health check failed. Ensure MSW is enabled or q_backend is running at {env.apiBaseUrl}.
            </p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-silver-400">Status</dt>
                <dd className="font-mono capitalize text-silver-100">{health.status}</dd>
              </div>
              <div>
                <dt className="text-silver-400">Version</dt>
                <dd className="font-mono text-silver-100">{health.backendVersion}</dd>
              </div>
              <div>
                <dt className="text-silver-400">Data lake</dt>
                <dd className="font-mono capitalize text-silver-100">{health.dataLakeStatus}</dd>
              </div>
              <div>
                <dt className="text-silver-400">Last sync</dt>
                <dd className="font-mono text-silver-100">
                  {new Date(health.lastSyncAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
