import { useState, useEffect } from 'react'
import { useSystemHealth } from '@/api/queries/system'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { env } from '@/lib/env'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { useAppStore } from '@/store/useAppStore'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'
import { Sun, SunDim, SunMoon } from 'lucide-react'

const presetButtonClass =
  'text-silver-300 border-brass-600/20 bg-carbon-900/40 hover:bg-carbon-800/80 hover:border-brass-500/40 hover:text-brass-400 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5'

const presetButtonActiveClass =
  'text-brass-400 border-brass-500/50 bg-brass-600/15 rounded-md border px-3 py-1.5 text-xs font-semibold shadow-[0_0_10px_rgba(196,165,116,0.08)] cursor-pointer flex items-center gap-1.5'

const inputClass =
  'w-full bg-carbon-950/80 border border-brass-600/15 rounded-lg px-3 py-2 text-xs text-silver-100 placeholder-silver-500 focus:outline-none focus:border-brass-500/60 focus:ring-2 focus:ring-brass-500/15 transition-all shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] cursor-pointer'

export function SystemWorkspace() {
  const { data: health, isLoading, isError, refetch, isFetching } = useSystemHealth()

  const brightnessMode = useAppStore((s) => s.brightnessMode)
  const setBrightnessMode = useAppStore((s) => s.setBrightnessMode)
  const highStart = useAppStore((s) => s.autoBrightnessHighStart)
  const midStart = useAppStore((s) => s.autoBrightnessMidStart)
  const lowStart = useAppStore((s) => s.autoBrightnessLowStart)
  const setAutoBrightnessConfig = useAppStore((s) => s.setAutoBrightnessConfig)
  const resolvedBrightness = useResolvedBrightness()

  const [localTimeStr, setLocalTimeStr] = useState(() =>
    new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTimeStr(
        new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const formatHourLabel = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const displayHour = h % 12 === 0 ? 12 : h % 12
    return `${displayHour} ${ampm} (${String(h).padStart(2, '0')}:00)`
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-silver-100 text-xl font-medium">System</h1>
        <p className="text-silver-400 text-sm">
          Runtime configuration and backend connectivity (mock API in Phase 1).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Display & Brightness</CardTitle>
          <CardDescription>
            Configure the user interface theme, brightness levels, and automatic scheduling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-silver-300 text-sm font-medium">Brightness Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBrightnessMode('high')}
                className={brightnessMode === 'high' ? presetButtonActiveClass : presetButtonClass}
              >
                <Sun className="h-3.5 w-3.5" />
                High
              </button>
              <button
                type="button"
                onClick={() => setBrightnessMode('mid')}
                className={brightnessMode === 'mid' ? presetButtonActiveClass : presetButtonClass}
              >
                <SunDim className="h-3.5 w-3.5" />
                Mid
              </button>
              <button
                type="button"
                onClick={() => setBrightnessMode('auto')}
                className={brightnessMode === 'auto' ? presetButtonActiveClass : presetButtonClass}
              >
                <SunMoon className="h-3.5 w-3.5" />
                Auto (Time-based)
              </button>
            </div>
          </div>

          {brightnessMode === 'auto' && (
            <div className="border-brass-600/10 bg-carbon-900/20 grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-silver-400 text-[10px] font-semibold tracking-wider uppercase">
                  High Brightness Start
                </label>
                <select
                  value={highStart}
                  onChange={(e) => setAutoBrightnessConfig({ highStart: Number(e.target.value) })}
                  className={inputClass}
                >
                  {hours.map((h) => (
                    <option key={h} value={h} className="bg-carbon-950 text-silver-100">
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-silver-400 text-[10px] font-semibold tracking-wider uppercase">
                  Mid Brightness Start
                </label>
                <select
                  value={midStart}
                  onChange={(e) => setAutoBrightnessConfig({ midStart: Number(e.target.value) })}
                  className={inputClass}
                >
                  {hours.map((h) => (
                    <option key={h} value={h} className="bg-carbon-950 text-silver-100">
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-silver-400 text-[10px] font-semibold tracking-wider uppercase">
                  Low Brightness Start
                </label>
                <select
                  value={lowStart}
                  onChange={(e) => setAutoBrightnessConfig({ lowStart: Number(e.target.value) })}
                  className={inputClass}
                >
                  {hours.map((h) => (
                    <option key={h} value={h} className="bg-carbon-950 text-silver-100">
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="border-brass-600/10 bg-brass-600/5 text-silver-300 flex flex-wrap items-center justify-between gap-3 rounded-lg p-3 text-xs">
            <div>
              <span className="text-brass-400 mr-2 font-sans font-semibold">
                Resolved Active Theme:
              </span>
              <span className="text-cream-200 font-mono capitalize">
                {resolvedBrightness}
                {brightnessMode === 'auto' ? ' (Auto)' : ''}
              </span>
              {resolvedBrightness === 'low' && (
                <span className="text-silver-500 ml-2">(using Mid backgrounds as fallback)</span>
              )}
            </div>
            <div className="text-silver-400">
              Local Time:{' '}
              <span className="text-brass-400 font-mono font-semibold">{localTimeStr}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>Frontend runtime targets</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="border-carbon-700 flex justify-between gap-4 border-b pb-2">
              <dt className="text-silver-400">API base URL</dt>
              <dd className="text-silver-100 font-mono">{env.apiBaseUrl}</dd>
            </div>
            <div className="border-carbon-700 flex justify-between gap-4 border-b pb-2">
              <dt className="text-silver-400">MSW mocks</dt>
              <dd className="text-silver-100 font-mono">
                {env.enableMsw ? 'enabled' : 'disabled'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-silver-400">Build mode</dt>
              <dd className="text-silver-100 font-mono">
                {env.isDev ? 'development' : 'production'}
              </dd>
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
            className="text-brass-400 hover:text-brass-500 text-xs disabled:opacity-50"
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-silver-400 text-sm">Loading health…</p>
          ) : isError || !health ? (
            <p className="text-sm text-red-300">
              Health check failed. Ensure MSW is enabled or q_backend is running at {env.apiBaseUrl}
              .
            </p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-silver-400">Status</dt>
                <dd className="text-silver-100 font-mono capitalize">{health.status}</dd>
              </div>
              <div>
                <dt className="text-silver-400">Version</dt>
                <dd className="text-silver-100 font-mono">{health.backendVersion}</dd>
              </div>
              <div>
                <dt className="text-silver-400">Data lake</dt>
                <dd className="text-silver-100 font-mono capitalize">{health.dataLakeStatus}</dd>
              </div>
              <div>
                <dt className="text-silver-400">Last sync</dt>
                <dd className="text-silver-100 font-mono">
                  {formatDisplayDateTime(health.lastSyncAt)}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
