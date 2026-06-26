import { useState, useEffect } from 'react'

import { useDataSource, useSetDataSource, useSystemHealth } from '@/api/queries/system'
import { LabeledField } from '@/components/ui/LabeledField'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { StatTile } from '@/components/ui/StatTile'
import { Button } from '@/components/ui/button'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import { env } from '@/lib/env'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { useAppStore } from '@/store/useAppStore'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'
import type { DataSourceMode } from '@/types/storage'

const DATA_SOURCE_OPTIONS: { value: DataSourceMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'mt5', label: 'MT5' },
  { value: 'local', label: 'Local' },
]

export function SystemWorkspace() {
  const { data: health, isLoading, isError, refetch, isFetching } = useSystemHealth()
  const { data: dataSource, isLoading: dataSourceLoading } = useDataSource()
  const setDataSource = useSetDataSource()

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
        <h1 className="text-brass-400 text-xl font-bold">System</h1>
        <p className="text-silver-400 mt-1 text-sm">
          Runtime configuration and backend connectivity (mock API in Phase 1).
        </p>
      </div>

      <Panel className="p-0">
        <PanelHeader title="Display & Brightness" />
        <div className="space-y-6 px-4 pb-4">
          <p className="text-silver-400 -mt-1 text-xs">
            Configure the user interface theme, brightness levels, and automatic scheduling.
          </p>

          <LabeledField label="Brightness mode">
            <SegmentedToggle
              aria-label="Brightness mode"
              value={brightnessMode}
              onChange={setBrightnessMode}
              options={[
                { value: 'high', label: 'High' },
                { value: 'mid', label: 'Mid' },
                { value: 'auto', label: 'Auto' },
              ]}
            />
          </LabeledField>

          {brightnessMode === 'auto' ? (
            <Panel className="grid gap-4 p-4 sm:grid-cols-3">
              <LabeledField label="High brightness start" htmlFor="sys-high-start">
                <select
                  id="sys-high-start"
                  value={highStart}
                  onChange={(e) => setAutoBrightnessConfig({ highStart: Number(e.target.value) })}
                  className={wellInputClass}
                >
                  {hours.map((h) => (
                    <option key={h} value={h} className="bg-carbon-950 text-silver-100">
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
              </LabeledField>

              <LabeledField label="Mid brightness start" htmlFor="sys-mid-start">
                <select
                  id="sys-mid-start"
                  value={midStart}
                  onChange={(e) => setAutoBrightnessConfig({ midStart: Number(e.target.value) })}
                  className={wellInputClass}
                >
                  {hours.map((h) => (
                    <option key={h} value={h} className="bg-carbon-950 text-silver-100">
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
              </LabeledField>

              <LabeledField label="Low brightness start" htmlFor="sys-low-start">
                <select
                  id="sys-low-start"
                  value={lowStart}
                  onChange={(e) => setAutoBrightnessConfig({ lowStart: Number(e.target.value) })}
                  className={wellInputClass}
                >
                  {hours.map((h) => (
                    <option key={h} value={h} className="bg-carbon-950 text-silver-100">
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
              </LabeledField>
            </Panel>
          ) : null}

          <Panel className="flex flex-wrap items-center justify-between gap-3 p-3">
            <StatTile
              className="min-w-[12rem] flex-1 p-3"
              label="Resolved active theme"
              value={`${resolvedBrightness}${brightnessMode === 'auto' ? ' (auto)' : ''}`}
              highlight
            />
            <StatTile className="min-w-[10rem] p-3" label="Local time" value={localTimeStr} />
          </Panel>
          {resolvedBrightness === 'low' ? (
            <p className="text-silver-500 text-xs">
              Low brightness uses mid backgrounds as fallback.
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel className="p-0">
        <PanelHeader title="Data Source" />
        <div className="space-y-4 px-4 pb-4">
          <p className="text-silver-400 -mt-1 text-xs">
            Choose where market data comes from. Auto uses MetaTrader 5 when available, otherwise
            the local parquet store.
          </p>
          {dataSourceLoading && !dataSource ? (
            <p className="text-silver-400 text-sm">Loading data source…</p>
          ) : (
            <>
              <SegmentedToggle
                aria-label="Data source"
                value={dataSource?.source ?? 'auto'}
                onChange={(mode) => setDataSource.mutate(mode)}
                options={DATA_SOURCE_OPTIONS.map((option) => ({
                  ...option,
                  disabled: setDataSource.isPending,
                }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <StatTile
                  className="p-3"
                  label="MT5 available"
                  value={dataSource?.mt5_available ? 'yes' : 'no'}
                />
                <StatTile
                  className="p-3"
                  label="Active provider"
                  value={dataSource?.active_provider ?? '—'}
                />
              </div>
              {dataSource?.source === 'local' && !dataSource.mt5_available ? (
                <p className="text-silver-400 text-xs">
                  Local mode without MT5 is expected on Linux — candle backtests read the parquet
                  store configured under Storage.
                </p>
              ) : null}
            </>
          )}
        </div>
      </Panel>

      <Panel className="p-0">
        <PanelHeader title="Environment" />
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
          <StatTile className="p-3" label="API base URL" value={env.apiBaseUrl} />
          <StatTile
            className="p-3"
            label="MSW mocks"
            value={env.enableMsw ? 'enabled' : 'disabled'}
          />
          <StatTile
            className="p-3"
            label="Build mode"
            value={env.isDev ? 'development' : 'production'}
          />
        </div>
      </Panel>

      <Panel className="p-0">
        <PanelHeader
          title="Backend health"
          right={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-brass-400 hover:text-brass-300 h-auto px-0 py-0 text-xs"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
        />
        <div className="px-4 pb-4">
          <p className="text-silver-400 -mt-1 mb-4 text-xs">GET /api/v1/system/health</p>
          {isLoading ? (
            <p className="text-silver-400 text-sm">Loading health…</p>
          ) : isError || !health ? (
            <p className="text-sm text-red-300">
              Health check failed. Ensure MSW is enabled or q_backend is running at {env.apiBaseUrl}
              .
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile className="p-3" label="Status" value={health.status} />
              <StatTile className="p-3" label="Version" value={health.backendVersion} />
              <StatTile className="p-3" label="Data lake" value={health.dataLakeStatus} />
              <StatTile
                className="p-3"
                label="Last sync"
                value={formatDisplayDateTime(health.lastSyncAt)}
              />
              {health.market_data_root ? (
                <StatTile
                  className="p-3 sm:col-span-2"
                  label="Market data root"
                  value={`${health.market_data_root}${
                    health.market_data_inventory_count != null
                      ? ` · ${health.market_data_inventory_count} series`
                      : ''
                  }`}
                />
              ) : null}
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
