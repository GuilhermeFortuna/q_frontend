import { endOfDay, formatISO, startOfDay, subMonths } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

import { useDataSource } from '@/api/queries/system'
import {
  useIngestStatus,
  useStartIngest,
  useDeleteStorage,
  useStorageInventory,
} from '@/api/queries/storage'
import { useSearchSymbols } from '@/api/queries/market-data'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  inputClass,
  presetButtonActiveClass,
  presetButtonClass,
} from '@/components/shared/InstrumentConfigFields'
import { formatBytes } from '@/lib/formatBytes'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import {
  inventoryItemKey,
  isIngestTerminalStatus,
  resolveInventoryKind,
  STORAGE_TIMEFRAME_OPTIONS,
  type IngestKind,
  type StorageKind,
} from '@/types/storage'

function KindBadge({ kind }: { kind: StorageKind }) {
  const isTicks = kind === 'ticks'
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
        isTicks ? 'bg-violet-500/10 text-violet-300' : 'bg-brass-500/10 text-brass-300',
      )}
    >
      {isTicks ? 'Ticks' : 'Bars'}
    </span>
  )
}

export function StorageWorkspace() {
  const { data: inventory, isLoading: inventoryLoading } = useStorageInventory()
  const { data: dataSource } = useDataSource()
  const startIngest = useStartIngest()
  const deleteStorage = useDeleteStorage()

  const [symbol, setSymbol] = useState('PETR4')
  const [symbolQuery, setSymbolQuery] = useState('')
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['D1'])
  const [startDate, setStartDate] = useState(() =>
    formatISO(subMonths(new Date(), 6), { representation: 'date' }),
  )
  const [endDate, setEndDate] = useState(() => formatISO(new Date(), { representation: 'date' }))
  const [dataKind, setDataKind] = useState<IngestKind>('bars')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const searchQuery = symbolQuery.trim().length >= 1 ? symbolQuery : symbol
  const symbolSearch = useSearchSymbols(searchQuery)
  const suggestions = useMemo(() => symbolSearch.data ?? [], [symbolSearch.data])

  const ingestStatus = useIngestStatus(activeJobId)
  const ingestJob = ingestStatus.data
  const mt5Available = dataSource?.mt5_available ?? false
  const isTicksKind = dataKind === 'ticks'
  const downloadDisabled =
    !mt5Available ||
    startIngest.isPending ||
    (!!activeJobId && !isIngestTerminalStatus(ingestJob?.status))
  const canDownload = symbol.trim().length > 0 && (isTicksKind || selectedTimeframes.length > 0)

  useEffect(() => {
    if (ingestJob && isIngestTerminalStatus(ingestJob.status)) {
      const timer = window.setTimeout(() => setActiveJobId(null), 4000)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [ingestJob])

  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes((current) =>
      current.includes(tf) ? current.filter((item) => item !== tf) : [...current, tf],
    )
  }

  const handleDownload = () => {
    if (!canDownload) return
    const start = startOfDay(new Date(startDate))
    const end = endOfDay(new Date(endDate))
    startIngest.mutate(
      {
        symbol: symbol.trim().toUpperCase(),
        timeframes: isTicksKind ? [] : selectedTimeframes,
        start: start.toISOString(),
        end: end.toISOString(),
        kind: dataKind,
      },
      {
        onSuccess: (response) => {
          setActiveJobId(response.job_id)
        },
      },
    )
  }

  const startError = startIngest.error
    ? axios.isAxiosError(startIngest.error)
      ? ((startIngest.error.response?.data as { detail?: string })?.detail ??
        startIngest.error.message)
      : 'Failed to start ingest job'
    : null

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-silver-100 text-xl font-medium">Storage</h1>
        <p className="text-silver-400 text-sm">
          Download OHLCV bars or tick data from MetaTrader 5 into the local parquet store, then
          serve them in Local data-source mode on Linux.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download from MT5</CardTitle>
          <CardDescription>
            Fills the portable store under{' '}
            <span className="text-silver-200 font-mono">{inventory?.root ?? 'data/market'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!mt5Available ? (
            <p className="text-silver-300 border-brass-600/20 bg-carbon-900/40 rounded-lg border px-3 py-2 text-sm">
              Downloading needs MT5 — run this on the Windows machine with MetaTrader connected.
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="storage-symbol" className="text-silver-300 text-sm font-medium">
                Symbol
              </label>
              <input
                id="storage-symbol"
                type="text"
                value={symbol}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase()
                  setSymbol(value)
                  setSymbolQuery(value)
                }}
                className={inputClass}
                placeholder="e.g. PETR4"
              />
              {suggestions.length > 0 ? (
                <ul className="border-carbon-700 bg-carbon-950/90 max-h-32 overflow-y-auto rounded-lg border text-xs">
                  {suggestions.slice(0, 6).map((item) => (
                    <li key={item.symbol}>
                      <button
                        type="button"
                        className="hover:bg-carbon-800/70 text-silver-200 w-full px-3 py-2 text-left"
                        onClick={() => {
                          setSymbol(item.symbol)
                          setSymbolQuery(item.symbol)
                        }}
                      >
                        <span className="text-brass-400 font-mono font-semibold">
                          {item.symbol}
                        </span>
                        <span className="text-silver-500 ml-2">{item.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-1">
              <span className="text-silver-300 text-sm font-medium">Data kind</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={dataKind === 'bars' ? presetButtonActiveClass : presetButtonClass}
                  onClick={() => setDataKind('bars')}
                >
                  Bars
                </button>
                <button
                  type="button"
                  className={dataKind === 'ticks' ? presetButtonActiveClass : presetButtonClass}
                  onClick={() => setDataKind('ticks')}
                >
                  Ticks
                </button>
              </div>
            </div>
          </div>

          {isTicksKind ? (
            <p className="text-silver-300 rounded-lg border border-violet-500/20 bg-violet-950/20 px-3 py-2 text-sm">
              Tick ranges are very large and ingest slowly (progress advances per month). Start with
              a narrow date range — a few days or one week — before pulling longer history.
            </p>
          ) : (
            <div className="space-y-2">
              <span className="text-silver-300 text-sm font-medium">Timeframes</span>
              <div className="flex flex-wrap gap-2">
                {STORAGE_TIMEFRAME_OPTIONS.map((tf) => {
                  const active = selectedTimeframes.includes(tf)
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => toggleTimeframe(tf)}
                      className={active ? presetButtonActiveClass : presetButtonClass}
                    >
                      {tf}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="storage-start" className="text-silver-300 text-sm font-medium">
                Start
              </label>
              <input
                id="storage-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="storage-end" className="text-silver-300 text-sm font-medium">
                End
              </label>
              <input
                id="storage-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloadDisabled || !canDownload}
              className={cn(
                presetButtonActiveClass,
                'px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {startIngest.isPending ? 'Starting…' : 'Download'}
            </button>
            {startError ? <p className="text-sm text-rose-300">{startError}</p> : null}
          </div>

          {ingestJob && activeJobId ? (
            <div className="border-brass-600/15 bg-carbon-900/30 space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-silver-200 capitalize">{ingestJob.status}</span>
                <span className="text-brass-400 font-mono tabular-nums">
                  {Math.round((ingestJob.progress ?? 0) * 100)}%
                </span>
              </div>
              <div className="bg-carbon-950/85 border-brass-600/10 h-2 overflow-hidden rounded-full border">
                <div
                  className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r transition-all"
                  style={{ width: `${Math.round((ingestJob.progress ?? 0) * 100)}%` }}
                />
              </div>
              <p className="text-silver-400 text-sm">{ingestJob.detail}</p>
              {ingestJob.results?.map((row) => (
                <p key={row.timeframe} className="text-silver-500 font-mono text-xs">
                  {row.timeframe}: {row.status}
                  {row.rows != null ? ` · ${row.rows} rows` : ''}
                  {row.error ? ` · ${row.error}` : ''}
                </p>
              ))}
              {ingestJob.error ? <p className="text-sm text-rose-300">{ingestJob.error}</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>Stored bars and ticks in the local parquet catalog</CardDescription>
        </CardHeader>
        <CardContent>
          {inventoryLoading ? (
            <p className="text-silver-400 text-sm">Loading inventory…</p>
          ) : !inventory?.items.length ? (
            <p className="text-silver-400 text-sm">
              The store is empty. On Windows with MT5 connected, use Download above to ingest bars
              or ticks for a symbol.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-silver-400 border-carbon-700 border-b text-xs tracking-wide uppercase">
                    <th className="px-2 py-2 font-medium">Symbol</th>
                    <th className="px-2 py-2 font-medium">Kind</th>
                    <th className="px-2 py-2 font-medium">Timeframe</th>
                    <th className="px-2 py-2 font-medium">Range</th>
                    <th className="px-2 py-2 font-medium">Rows</th>
                    <th className="px-2 py-2 font-medium">Size</th>
                    <th className="px-2 py-2 font-medium">Updated</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {inventory.items.map((item) => {
                    const kind = resolveInventoryKind(item)
                    const isTicks = kind === 'ticks'
                    return (
                      <tr key={inventoryItemKey(item)} className="border-carbon-800/80 border-b">
                        <td className="text-silver-100 px-2 py-2 font-mono">{item.symbol}</td>
                        <td className="px-2 py-2">
                          <KindBadge kind={kind} />
                        </td>
                        <td className="text-silver-200 px-2 py-2 font-mono">
                          {isTicks ? '—' : (item.timeframe ?? '—')}
                        </td>
                        <td className="text-silver-300 px-2 py-2 font-mono text-xs">
                          {formatDisplayDateTime(item.start)} → {formatDisplayDateTime(item.end)}
                        </td>
                        <td className="text-silver-200 px-2 py-2 tabular-nums">{item.rows}</td>
                        <td className="text-silver-300 px-2 py-2">{formatBytes(item.bytes)}</td>
                        <td className="text-silver-400 px-2 py-2 text-xs">
                          {formatDisplayDateTime(item.updated_at)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            className="text-xs font-semibold text-rose-300 hover:text-rose-200"
                            disabled={deleteStorage.isPending}
                            onClick={() => {
                              const label = isTicks
                                ? `Delete stored ${item.symbol} tick data?`
                                : `Delete stored ${item.symbol} ${item.timeframe} bar data?`
                              if (window.confirm(label)) {
                                deleteStorage.mutate({
                                  symbol: item.symbol,
                                  kind,
                                  timeframe: item.timeframe,
                                })
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
